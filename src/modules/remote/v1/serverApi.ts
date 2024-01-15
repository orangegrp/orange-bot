import { Logger } from "orange-common-lib";
import { WebSocketServer, WebSocket, RawData } from "ws";
import type { Bot } from "orange-bot-base";
import { IncomingMessage } from 'http';
import { VERSION, sendHello, sendError, sendStatus } from "./messages.js";
import handleAuth from "./auth.js";
import { getSession, validateSession } from "./session.js";
import { ClientDataRequest, ClientMessage, ClientMessageType, ClientStatusRequest } from "./types/client.t.js";
import { randomBytes } from "crypto";
import { ServerStatus } from "./types/server.t.js";

function onMessage(ws: WebSocket, req: IncomingMessage, logger: Logger, bot: Bot, msg: RawData) {
    logger.verbose(`Message received: ${msg.toString()}`);
    try {
        const message = JSON.parse(msg.toString()) as ClientMessage;
        const requestId = randomBytes(32).toString("hex");
        const session = getSession(message.sessionId);

        if (message.version !== VERSION)
            throw new Error("Client/Server version mismatch! The client message has been rejected.");

        switch (message.msgType) {
            case ClientMessageType.ClientHelloRequest:
                sendHello(ws);
                break;
            case ClientMessageType.ClientAuth:
                handleAuth(message, ws, req, logger, bot, msg);
                break;
            case ClientMessageType.ClientDataRequest:
                if (!session || !validateSession(ws, req, message.sessionId))
                    throw new Error("Invalid session ID or IP mismatch! Cannot service the request.");         
                const requestData = message.payload as ClientDataRequest;  
                session.client_requests.set(requestId, requestData);
                
                // TODO

                session.client_requests.delete(requestId);
                break;
            case ClientMessageType.ClientStatusRequest:
                if (!session || !validateSession(ws, req, message.sessionId))
                    throw new Error("Invalid session ID or IP mismatch! Cannot service the request.");            
                    const request = message.payload as ClientStatusRequest;
                    const originalRequest = session.client_requests.get(request.reqId);
                    
                    if (originalRequest) {
                        sendStatus(ServerStatus.Waiting, ws);
                        return;
                    } else {
                        sendStatus(ServerStatus.Success, ws);
                    }
    
                    session.client_requests.delete(requestId);
                break;
            default:
                sendError("Unknown message type! Server will ignore the message.", ws);
                break;
        }
    } catch (err: any) {
        logger.error(err);
        sendError(`Unexpected error! The message reads: \"${err.message}\"`, ws);
        ws.close();
        req.destroy();
    }
}

function onConnection(ws: WebSocket, req: IncomingMessage, logger: Logger, bot: Bot) {
    logger.verbose(`New client connected. Protocol: ${ws.protocol}\tRemote Addr: ${req.socket.remoteAddress}\tRemote Port: ${req.socket.remotePort}\tLocal Addr: ${req.socket.localAddress}\tLocal Port: ${req.socket.localPort}`);
    ws.on("message", (msg) => onMessage(ws, req, logger.sublogger("onMessage"), bot, msg));
}

export default function (wss: WebSocketServer, logger: Logger, bot: Bot) {
    wss.on("connection", (ws, req) => onConnection(ws, req, logger.sublogger("Remote WS > onConnection"), bot));
}