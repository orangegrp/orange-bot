import { FastifyInstance, FastifyReply, FastifyRequest, RouteShorthandOptions } from "fastify";
import crypto from "crypto";
import { Logger } from "orange-common-lib";
import { NewsSource } from "../../news.js";
import { addSource, getSource, removeSource, updateSource } from "../../srcmgr.js";

let logger: Logger;

const fastify_request_schema = {
    type: "object",
    properties: {
        name: { type: "string" },
        icon: { type: "string" },
        feedType: {
            type: "string",
            enum: ["RSS", "Atom", "JSON", "YouTube", "Telegram"]
        },
        feedIcon: { type: "string" },
        feedUrl: {
            type: "string",
            format: "uri"
        },
        crawl: { type: "boolean"},
        crawlOpts: {
            type: "object",
            properties: {
                openGraph: { type: "boolean" },
                content: { type: "boolean" },
                contentOpts: {
                    type: "object",
                    properties: {
                        stripHtml: { type: "boolean" },
                        xpaths: {
                            type: "array",
                            items: { type: "string" }
                        }
                    },
                    required: ["stripHtml", "xpaths"]
                }
            },
            required: ["openGraph", "content", "contentOpts"]
        },
        aiSummary: { type: "boolean" },
        aiSummaryOpts: {
            type: "object",
            properties: {
                maxContentLen: { type: "number" },
                openAi: {
                    type: "object",
                    properties: {
                        assistantId: { type: "string" }
                    },
                    required: ["assistantId"]
                }
            },
            required: ["maxContentLen", "openAi"]
        },
        reputation: {
            type: "object",
            properties: {
                score: {
                    type: "string",
                    enum: [
                        "Very high factuality",
                        "High factuality",
                        "Fair factuality",
                        "Disputed factuality",
                        "Low factuality",
                        "Unreliable factuality"
                    ]
                },
                authorship: {
                    type: "object",
                    properties: {
                        countryFlag: { type: "string" },
                        country: { type: "string" },
                        media: {
                            type: "string",
                            enum: [
                                "Independent media outlet",
                                "Affiliated media outlet",
                                "Media outlet owned in whole or in part by News Corp",
                                "Media outlet owned in whole or in part by a national government",
                                "Media outlet funded in whole or in part by a national government"
                            ]
                        },
                        notes: { type: "string" }
                    },
                    required: ["countryFlag", "country", "media"]
                }
            },
            required: ["score", "authorship"]
        }
    },
    required: ["name","feedType", "feedUrl", "crawl", "aiSummary"]
};

type request_schema = Omit<NewsSource, "id"> & { gid: string };
type reply_schema = {
    request_id: string,
    success: boolean,
    source_id?: string
    message?: string,
    data?: NewsSource
};

function catchError(err: Error | any, req: FastifyRequest, reply: FastifyReply, method: string) {
    const request_id = req.headers["orange-application-request-id"] ?? crypto.randomBytes(16).toString("hex");
    logger.warn(`${method} ${req.url} has encountered an exception in the inner try/catch block.\t(orange-application-request-id: ${request_id})`);
    logger.error(err);
    reply.status(500).send({
        request_id: request_id,
        success: false,
        message: err.message
    } as reply_schema);
}


function get(req: FastifyRequest<{Params: { id: string, gid: string }}>, reply: FastifyReply) {
    const req_id = req.headers["orange-application-request-id"];

    try {
        const { gid, id } = req.params;

        const source = getSource(gid, id);

        if (!source) {
            reply.status(404).send({
                request_id: req_id,
                success: false,
                message: "Source not found."
            } as reply_schema);
        }

        reply.status(200).send({
            request_id: req_id,
            success: true,
            data: source
        } as reply_schema);
    } catch (err: Error | any) {
        catchError(err, req, reply, "GET");
    }
}

function del(req: FastifyRequest<{Params: { id: string, gid: string }}>, reply: FastifyReply) {
    const req_id = req.headers["orange-application-request-id"];

    try {
        const { gid, id } = req.params;

        if (!getSource(gid, id)) {
            reply.status(404).send({
                request_id: req_id,
                success: false,
                message: "Source not found."
            } as reply_schema);
        }

        removeSource(gid, id);

        reply.status(200).send({
            request_id: req_id,
            success: true,
            message: "Source deleted successfully."
        } as reply_schema);
    } catch (err: Error | any) {
        catchError(err, req, reply, "DELETE");
    }
}

function put(req: FastifyRequest<{Params: { id: string, gid: string }}>, reply: FastifyReply) {
    const req_id = req.headers["orange-application-request-id"];

    try {
        const { gid, id } = req.params;

        if (!getSource(gid, id)) {
            reply.status(404).send({
                request_id: req_id,
                success: false,
                message: "Source not found."
            } as reply_schema);
        }

        const request_info: request_schema = req.body as request_schema;
        const source: NewsSource = {
            id: id,
            ...request_info
        };

        updateSource(gid, id, source);

        reply.status(200).send({
            request_id: req_id,
            success: true,
            message: "Source updated successfully."
        } as reply_schema);
    } catch (err: Error | any) {
        catchError(err, req, reply, "PUT");
    }
}

function post(req: FastifyRequest<{Params: { gid: string }}>, reply: FastifyReply) {
    const req_id = req.headers["orange-application-request-id"];

    try {
        const { gid } = req.params;

        const request_info: request_schema = req.body as request_schema;
        const src_id = crypto.randomBytes(4).toString("hex");
        
        const source: NewsSource = {
            id: src_id,
            ...request_info
        };

        if (getSource(gid, source.id)) {
            reply.status(409).send({
                request_id: req_id,
                success: false,
                message: "Source with same idalready exists."
            } as reply_schema);
            return;
        }

        addSource(gid, source);

        reply.status(200).send({
            request_id: req_id,
            success: true,
            source_id: src_id,
            message: "Source added successfully."
        } as reply_schema);

    } catch (err: Error | any) {
        catchError(err, req, reply, "POST");
    }
}

export default function (fastify: FastifyInstance, path: string, _logger: Logger, opts?: RouteShorthandOptions) {
    logger = _logger;

    const path_gid = `${path}/:gid`;
    const path_gid_id = `${path}/:gid/:id`;

    logger.log(`Registering Fastify route POST ${path_gid}...`);
    fastify.post(path_gid, { schema: { body: fastify_request_schema } }, post);     // add news source
    logger.ok(`Route POST ${path_gid} registered.`);

    logger.log(`Registering Fastify route DELETE  ...`);
    fastify.delete(path_gid_id, del);     // remove news source
    logger.ok(`Route DELETE ${path_gid_id} registered.`);

    logger.log(`Registering Fastify route GET ${path_gid_id} ...`);
    fastify.get(path_gid_id, get);     // get news source
    logger.ok(`Route GET ${path_gid_id} registered.`);

    logger.log(`Registering Fastify route PUT ${path_gid_id} ...`);
    fastify.put(path_gid_id, { schema: { body: fastify_request_schema } }, put);     // update news source
    logger.ok(`Route PUT ${path_gid_id} registered.`);
}