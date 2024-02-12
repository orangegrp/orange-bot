import { FastifyInstance, FastifyReply, FastifyRequest, RouteShorthandOptions } from "fastify";
import crypto from "crypto";
import { Logger } from "orange-common-lib";
import { NewsSource } from "../../news.js";
import { addSource, getSource } from "../../srcmgr.js";

let logger: Logger;

const fastify_request_schema = {
    type: "object",
    properties: {
        name: { type: "string" },
        feedType: {
            type: "string",
            enum: ["RSS", "Atom", "JSON", "YouTube", "Telegram"]
        },
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

type request_schema = Omit<NewsSource, "id"> & {};
type reply_schema = {
    request_id: string,
    success: boolean,
    source_id?: string
    message?: string,
}

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

function post(req: FastifyRequest, reply: FastifyReply) {
    const req_id = req.headers["orange-application-request-id"];

    try {
        const request_info: request_schema = req.body as request_schema;
        const src_id = crypto.randomBytes(4).toString("hex");
        
        const source: NewsSource = {
            id: src_id,
            ...request_info
        };

        if (getSource(source.id)) {
            reply.status(409).send({
                request_id: req_id,
                success: false,
                message: "Source with same idalready exists."
            } as reply_schema);
            return;
        }

        

        addSource(source);

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

    logger.log(`Registering Fastify route POST ${path} ...`);
    fastify.post(path, { schema: { body: fastify_request_schema } }, post);
    logger.ok(`Route POST ${path} registered.`);
}