import { FastifyInstance, FastifyReply, FastifyRequest, RouteShorthandOptions } from "fastify";
import crypto from "crypto";
import { Logger } from "orange-common-lib";
import { NewsConfig, NewsGuildConfig, NewsSource } from "../../news.js";
import { addGuild, addSource, getGuildSettings, getSettings, getSource, removeGuild, removeSource, setGuildSettings, setSettings, updateSource } from "../../srcmgr.js";

let logger: Logger;

const fastify_request_schema_global = {
    type: "object",
    properties: {
        enabled: { type: "boolean" },
        override: {
            type: "object",
            properties: {
                crawl: { type: "boolean" },
                aiSummary: { type: "boolean" }
            },
            additionalProperties: false
        },
        guilds: {
            type: "object",
            patternProperties: {
                "^[a-zA-Z0-9]+$": {
                    type: "object",
                    properties: {
                        enabled: { type: "boolean" },
                        channel_id: { type: "string" },
                        override: {
                            type: "object",
                            properties: {
                                crawl: { type: "boolean" },
                                aiSummary: { type: "boolean" }
                            },
                            additionalProperties: false
                        },
                        sources: {
                            type: "array",
                            items: { type: "object" }
                        }
                    },
                    required: ["enabled", "channel_id"],
                    additionalProperties: false
                }
            },
            additionalProperties: false
        }
    },
    required: ["enabled"],
    additionalProperties: false
}
const fastify_request_schema_guild = {
    type: "object",
    properties: {
        enabled: { type: "boolean" },
        channel_id: { type: "string" },
        override: {
            type: "object",
            properties: {
                crawl: { type: "boolean" },
                aiSummary: { type: "boolean" }
            },
            additionalProperties: false
        }
    },
    required: ["enabled", "channel_id"],
    additionalProperties: false
};

const fastify_request_schema = {
    oneOf: [
        {
            type: "object",
            properties: {
                enabled: { type: "boolean" },
                override: {
                    type: "object",
                    properties: {
                        crawl: { type: "boolean" },
                        aiSummary: { type: "boolean" }
                    },
                    additionalProperties: false
                },
                guilds: {
                    type: "object",
                    patternProperties: {
                        "^[a-zA-Z0-9]+$": {
                            type: "object",
                            properties: {
                                enabled: { type: "boolean" },
                                channel_id: { type: "string" },
                                override: {
                                    type: "object",
                                    properties: {
                                        crawl: { type: "boolean" },
                                        aiSummary: { type: "boolean" }
                                    },
                                    additionalProperties: false
                                },
                                sources: {
                                    type: "array",
                                    items: { type: "object" }
                                }
                            },
                            required: ["enabled", "channel_id"],
                            additionalProperties: false
                        }
                    },
                    additionalProperties: false
                }
            },
            required: ["enabled"],
            additionalProperties: false
        },
        {
            type: "object",
            properties: {
                enabled: { type: "boolean" },
                channel_id: { type: "string" },
                override: {
                    type: "object",
                    properties: {
                        crawl: { type: "boolean" },
                        aiSummary: { type: "boolean" }
                    },
                    additionalProperties: false
                }
            },
            required: ["enabled", "channel_id"],
            additionalProperties: false
        }
    ]
};

type request_schema = Omit<NewsConfig, "guilds">;
type request_schema_guild = Omit<NewsGuildConfig, "sources">;

type reply_schema = {
    request_id: string,
    success: boolean,
    source_id?: string
    message?: string,
    data?: Omit<NewsGuildConfig, "sources"> & { sources: string[] } | Omit<NewsConfig, "guilds"> & { guilds: string[] }
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


function get(req: FastifyRequest<{ Params: { gid: string } }>, reply: FastifyReply) {
    const req_id = req.headers["orange-application-request-id"];

    try {
        const { gid } = req.params;

        if (gid === undefined || gid.trim() === "") {
            const settings = getSettings();

            if (settings === null || settings === undefined) {
                reply.status(404).send({
                    request_id: req_id,
                    success: false,
                    message: "Settings not found."
                } as reply_schema);
                return;
            }

            reply.status(200).send({
                request_id: req_id,
                success: true,
                data: { ...settings, guilds: Object.keys(settings.guilds) },
            } as reply_schema);

        } else {
            const guildSettings = getGuildSettings(gid);

            if (guildSettings === null || guildSettings === undefined) {
                reply.status(404).send({
                    request_id: req_id,
                    success: false,
                    message: "Guild settings not found."
                } as reply_schema);
                return;
            }

            reply.status(200).send({
                request_id: req_id,
                success: true,
                data: { ...guildSettings, sources: guildSettings.sources.map(s => s.id) },
            } as reply_schema);
        }

    } catch (err: Error | any) {
        catchError(err, req, reply, "GET");
    }
}


function del(req: FastifyRequest<{ Params: { gid: string } }>, reply: FastifyReply) {
    const req_id = req.headers["orange-application-request-id"];

    try {
        const { gid } = req.params;

        const guildSettings = getGuildSettings(gid);

        if (guildSettings === null || guildSettings === undefined) {
            reply.status(404).send({
                request_id: req_id,
                success: false,
                message: "Guild settings not found."
            } as reply_schema);
            return;
        }

        removeGuild(gid);

        reply.status(200).send({
            request_id: req_id,
            success: true,
            data: { ...guildSettings, sources: guildSettings.sources.map(s => s.id) },
        } as reply_schema);

    } catch (err: Error | any) {
        catchError(err, req, reply, "GET");
    }
}

function put(req: FastifyRequest<{ Params: { gid: string } }>, reply: FastifyReply) {
    const req_id = req.headers["orange-application-request-id"];

    try {
        const { gid } = req.params;

        if (gid === undefined) {
            const settings = req.body as request_schema;

            setSettings(settings);

            reply.status(200).send({
                request_id: req_id,
                success: true
            } as reply_schema);
        } else {
            const guildSettings = req.body as request_schema_guild;

            setGuildSettings(gid, guildSettings);

            reply.status(200).send({
                request_id: req_id,
                success: true
            } as reply_schema);
        }

    } catch (err: Error | any) {
        catchError(err, req, reply, "PUT");
    }
}

function post(req: FastifyRequest<{ Params: { gid: string } }>, reply: FastifyReply) {
    const req_id = req.headers["orange-application-request-id"];

    try {
        const { gid } = req.params;

        const settings = getSettings();

        if (settings === null || settings === undefined) {
            reply.status(404).send({
                request_id: req_id,
                success: false,
                message: "Settings not found."
            } as reply_schema);
            return;
        }

        const guildSettings: NewsGuildConfig = {
            ...(req.body as request_schema_guild),
            sources: []
        }

        addGuild(gid, guildSettings);

        reply.status(200).send({
            request_id: req_id,
            success: true
        } as reply_schema);
    } catch (err: Error | any) {
        catchError(err, req, reply, "POST");
    }
}

export default function (fastify: FastifyInstance, path: string, _logger: Logger, opts?: RouteShorthandOptions) {
    logger = _logger;

    const path_gid = `${path}/:gid`;

    logger.log(`Registering Fastify route GET ${path_gid} and ${path} ...`);
    fastify.get(path_gid, get);     // get settings
    fastify.get(path, get);
    logger.ok(`Routes GET ${path_gid} and ${path} registered.`);

    logger.log(`Registering Fastify route PUT ${path_gid} and ${path} ...`);
    fastify.put(path_gid, { schema: { body: fastify_request_schema_guild } }, put);   // update settings
    fastify.put(path, { schema: { body: fastify_request_schema } }, put);
    logger.ok(`Routes PUT ${path_gid} and ${path} registered.`);

    logger.log(`Registering Fastify route POST ${path_gid} ...`);
    fastify.post(path_gid, { schema: { body: fastify_request_schema_guild } }, post);   // add new guild (with settings)
    logger.ok(`Route POST ${path_gid} registered.`);

    logger.log(`Registering Fastify route DELETE ${path_gid} ...`);
    fastify.delete(path_gid, del);     // remove guild
    logger.ok(`Route DELETE ${path_gid} registered.`);
}