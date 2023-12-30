import { Logger } from "orange-common-lib";
import { WebSocketServer, WebSocket, RawData } from "ws";
import jwt from "jsonwebtoken";
import type { Bot } from "orange-bot-base";
import { IncomingMessage } from 'http';
import { VERSION, sendHello, sendError, sendAuth } from "./messages.js";

export default function handleAuth(message: ClientMessage, ws: WebSocket, req: IncomingMessage, logger: Logger, bot: Bot, msg: RawData) {
    let auth = message.payload as ClientAuth;

    if (!process.env.REMOTE_SECRET)
        throw new Error(`Could not find the JWT secret! Cannot authenticate websocket client.`);

    if (!jwt.verify(auth.token, process.env.REMOTE_SECRET)) {
        sendAuth({
            msgType: ServerAuthMessageType.LoginFailed
        } as ServerAuth, ws);
    }

    if (auth.msgType === ClientAuthMessageType.LoginRequest) {
        sendAuth({
            msgType: ServerAuthMessageType.LoginSuccess,
            session_id: 'idk'
        } as ServerAuth, ws);
    } else if (auth.msgType === ClientAuthMessageType.LogoutRequest) {
        sendAuth({
            msgType: ServerAuthMessageType.LogoutSuccess
        } as ServerAuth, ws);
    }
}