import Fastify from "fastify";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Logger } from "orange-common-lib";
import news_source_v1 from "./modules/news/api/v1/source.js";
import news_settings_v1 from "./modules/news/api/v1/settings.js";

export default function(logger: Logger) {
    logger.info("orange🟠 Bot Admin API is starting!");
    logger.verbose("Initialising fastify web server ...");

    const fastify = Fastify( {
        logger: true,
        trustProxy: true
    });

    logger.ok("Fastify web server initialised.");
    logger.info("Fastify is using its own logger to print verbose messages to the console. For debugging purposes, please access the Docker console to view Fastify logs.");

    logger.verbose("Checking for NODE_ENV=production ...");

    if (process.env.NODE_ENV && process.env.NODE_ENV.trim() == "production") {
        logger.log("NODE_ENV=production detected, enabling production mode ...");
        fastify.setErrorHandler((error, _request, reply) => {
            logger.warn("Fastify error handler has been triggered. Replying with code 500 over the socket ...");
            logger.error(error);
            reply.status(500).send();
        });
        fastify.setNotFoundHandler((_request, reply) => {
            reply.status(404).send();
        });
    }

    logger.info("Registering Fastify routes ...");

    
    fastify.addHook("preHandler", (req, reply, next) => {
        if ((req.headers["content-type"] !== "application/json") && (req.method === "POST" || req.method === "PUT")) {
            reply.status(400).send();
            return;
        }

        if (!(process.env.JWT_SECRET_V1)) {
            reply.status(503).send();
            return;
        }
    
        if (!(req.headers.authorization)) {
            reply.status(400).send();
            return;
        }
    
        if (!jwt.verify(req.headers.authorization, process.env.JWT_SECRET_V1)) {
            reply.status(403).send();
            return;
        }

        const request_id = crypto.randomBytes(16).toString("hex");
        logger.log(`Incoming authenticated request from ${req.ip}, assigning request id: ${request_id} ...`);
        req.headers["orange-application-request-id"] = request_id;

        next();
    });

    // ADD ROUTES HERE
    news_source_v1(fastify, "/modules/news/api/v1/source", logger.sublogger("API v1"));
    news_settings_v1(fastify, "/modules/news/api/v1/settings", logger.sublogger("API v1"));

    logger.ok("Fastify routes registered.");

    const port = Number(process.env.PORT) || 3000;
    const host = "0.0.0.0";

    logger.log(`Starting Fastify web server on ${host}:${port} ...`);
    fastify.listen( { port: port, host: host } );
    logger.ok("Fastify web server started.");
}