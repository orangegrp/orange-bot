import { FastifyInstance, FastifyReply, FastifyRequest, RouteShorthandOptions } from "fastify";
import crypto from "crypto";
import { Logger } from "orange-common-lib";

const PISTON_API = "https://emkc.org/api/v2/piston/execute";
let logger: Logger;

const fastify_request_schema = {
    body: {
        properties: {
            code: { type: "string" },
            lang: { type: "string" },
            stdin: { type: "string" },
            args: { type: "array", items: { type: "string" } }
        },
        required: ["code", "lang"],
    }
}

type request_schema = {
    code: string,
    lang: string,
    stdin?: string,
    args?: string[]
}

type reply_schema = {
    id: string,
    data: any
}

function random_id() {
    return crypto.randomBytes(3).toString("hex");
}

function post(req: FastifyRequest, reply: FastifyReply) {
    const exec_id = random_id();

    logger.verbose(`Incoming exec request from ${req.ip}, exec ID: ${exec_id}...`);

    try {
        const request_info: request_schema = req.body as request_schema;

        logger.log(`Incoming exec request, exec ID: ${exec_id}. Content: ${JSON.stringify(request_info)}`);

        fetch(PISTON_API, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                language: request_info.lang,
                version: '*',
                files: [{ name: exec_id, content: request_info.code }],
                stdin: request_info.stdin,
                args: request_info.args
            })
        }).then(async resp => {
            logger.ok(`post(req, reply) has successfully completed. For exec ID: ${exec_id}`);
            reply.status(200).send({ id: exec_id, data: await resp.json() } as reply_schema);
            return;
        }).catch((err) => {
            logger.error(err);
            logger.warn(`post(req, reply) has encountered an exception in the fetch().catch() block. For exec ID: ${exec_id}`);
            reply.status(500).send({ id: exec_id });
            return;
        });
    } catch (err: Error | any) {
        logger.warn(`post(req, reply) has encountered an exception in the outer try/catch block. For exec ID: ${exec_id}`);
        logger.error(err);
        reply.status(500).send({ id: exec_id });
        return;
    }
}

export default function (fastify: FastifyInstance, path: string, _logger: Logger, opts?: RouteShorthandOptions) {
    logger = _logger;
    logger.log(`Registering Fastify route POST ${path} ...`);
    fastify.post(path, { schema: fastify_request_schema }, post);
    logger.ok(`Route POST ${path} registered.`);
}