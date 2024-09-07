import { FastifyInstance, FastifyReply, FastifyRequest, RouteShorthandOptions } from "fastify";
import { Logger } from "orange-common-lib";

const PISTON_API = "https://emkc.org/api/v2/piston/runtimes";
let logger: Logger;

function get(req: FastifyRequest, reply: FastifyReply) {
    try {
        fetch(PISTON_API, { headers: { 'Accept': 'application/json' }}).then(async resp => {
            logger.ok(`get(req, reply) has successfully completed.`);
            reply.status(200).send(await resp.json());
            return;
        }).catch((err) => {
            logger.error(err);
            logger.warn(`get(req, reply) has encountered an exception in the fetch().catch() block.`);
            reply.status(500).send();
            return;
        });
    } catch (err: Error | any) {
        logger.warn(`get(req, reply) has encountered an exception in the outer try/catch block.`);
        logger.error(err);
        reply.status(500).send();
        return;
    }
}

export default function (fastify: FastifyInstance, path: string, _logger: Logger, opts?: RouteShorthandOptions) {
    logger = _logger;
    logger.log(`Registering Fastify route POST ${path} ...`);
    fastify.get(path, {}, get);
    logger.ok(`Route GET ${path} registered.`);
}