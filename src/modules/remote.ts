import type { Bot } from "orange-bot-base";
import { WebSocketServer } from "ws";
import { getLogger } from "orange-common-lib";
import apiv1 from "./remote/v1/serverApi.js";

const logger = getLogger("remote wss");

export default function(bot: Bot) {
    logger.info("Starting websocket server API v1 on port 3002, path /remote/v1 ...");
    const wssV1 = new WebSocketServer( { port: 3002, path: "/remote/v1" } );
    apiv1(wssV1, logger.sublogger("v1"), bot);
}