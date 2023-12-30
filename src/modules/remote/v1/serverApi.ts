import { Logger } from "orange-common-lib";
import { WebSocketServer, WebSocket, RawData } from "ws";
import type { Bot } from "orange-bot-base";
import { IncomingMessage } from 'http';
import { VERSION, sendHello, sendError } from "./messages.js";
import handleAuth from "./auth.js";

const msgIdTest: RegExp = /^[a-z0-9]{16}$/;


function onMessage(ws: WebSocket, req: IncomingMessage, logger: Logger, bot: Bot, msg: RawData) {
    logger.verbose(`Message received: ${msg.toString()}`);
    try {
        let message = JSON.parse(msg.toString()) as ClientMessage;

        if (!msgIdTest.test(message.msgId))
            throw new Error("Illegal message ID! The client message has been rejected.");
        if (message.version !== VERSION)
            throw new Error("Client/Server version mismatch! The client message has been rejected.");

        switch (message.msgType) {
            case ClientMessageType.ClientHelloRequest:
                sendHello(ws);
                break;
            case ClientMessageType.ClientAuth:
                handleAuth(message, ws, req, logger, bot, msg);
                break;
            case ClientMessageType.ClientSessionInfo:
                break;
            case ClientMessageType.ClientDataRequest:
                break;
            case ClientMessageType.ClientStatusRequest:
                break;
            default:
                sendError("Unknown message type! Server will ignore the message.", ws);
                break;
        }
    } catch (err: any) {
        logger.error(err);
        sendError(`Unexpected error! The message reads: \"${err.message}\"`, ws);
    }
}

function onConnection(ws: WebSocket, req: IncomingMessage, logger: Logger, bot: Bot) {
    logger.verbose(`New client connected. Protocol: ${ws.protocol}\tRemote Addr: ${req.socket.remoteAddress}\tRemote Port: ${req.socket.remotePort}\tLocal Addr: ${req.socket.localAddress}\tLocal Port: ${req.socket.localPort}`);
    ws.on("message", (msg) => onMessage(ws, req, logger.sublogger("onMessage"), bot, msg));
}

export default function (wss: WebSocketServer, logger: Logger, bot: Bot) {
    wss.on("connection", (ws, req) => onConnection(ws, req, logger.sublogger("onConnection"), bot));
}