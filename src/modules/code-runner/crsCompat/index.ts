import "dotenv/config";
import { getLogger } from "orange-common-lib";
import Fastify from "fastify";
import v1 from "./v1/execute.js";
import v2 from "./v2/execute.js";
import v2_info from "./v2/info.js";

const logger = getLogger("CRS COMPAT");
logger.info("Hello World! orange🟠 Code Runner Service is starting!");
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
v1(fastify, "/api/v1/execute", logger.sublogger("API v1"));
v2(fastify, "/api/v2/execute", logger.sublogger("API v2"));
v2_info(fastify, "/api/v2/info", logger.sublogger("API v2"));

logger.ok("Fastify routes registered.");

const port = 5478;
const host = "127.0.0.1";

logger.log(`Starting Fastify web server on ${host}:${port} ...`);
fastify.listen( { port: port, host: host } );
logger.ok("Fastify web server started.");

export { port as CRS_PORT };