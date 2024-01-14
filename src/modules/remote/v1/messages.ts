import { WebSocket } from "ws";
import { ServerAuth, ServerError, ServerMessage, ServerMessageType, ServerStatus, ServerStatusReply } from "./types/server.t.js";

const VERSION = "1.0.0";

function sendAuth(payload: ServerAuth, ws: WebSocket) {
    ws.send(JSON.stringify(
        {
            version: VERSION,
            msgType: ServerMessageType.ServerAuth,
            payload: payload
        } as ServerMessage
    ));
}

function sendHello(ws: WebSocket) {
    ws.send(JSON.stringify(
        {
            version: VERSION,
            msgType: ServerMessageType.ServerHelloReply
        } as ServerMessage
    ));
}

function sendError(error: string, ws: WebSocket) {
    ws.send(JSON.stringify({
        version: VERSION,
        msgType: ServerMessageType.ServerError,
        payload:
            {
                message: error
            } as ServerError
    } as ServerMessage));
}

function sendStatus(status: ServerStatus, ws: WebSocket) {
    ws.send(JSON.stringify({
        version: VERSION,
        msgType: ServerMessageType.ServerStatusReply,
        payload:
            {
                status: status
            } as ServerStatusReply
    } as ServerMessage));
}

export { sendAuth, sendHello, sendError, sendStatus, VERSION }