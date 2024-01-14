import { Logger } from "orange-common-lib";
import { WebSocket, RawData } from "ws";
import jwt from "jsonwebtoken";
import type { Bot } from "orange-bot-base";
import { IncomingMessage } from 'http';
import { sendAuth } from "./messages.js";
import { beginSession, endAllSessions, endSession, endSessionByIp, validateSession } from "./session.js";
import { ServerAuth, ServerAuthMessageType } from "./types/server.t.js";
import { ClientAuth, ClientAuthMessageType, ClientMessage } from "./types/client.t.js";
 
function verifyToken(token: string, logger: Logger) {
    logger.verbose('Checking for REMOTE_SECRET environment variable ...');

    if (!process.env.REMOTE_SECRET)
        throw new Error(`Could not find the JWT secret! Cannot authenticate websocket client.`);
    
    logger.info('Validating token ...');

    if (!jwt.verify(token, process.env.REMOTE_SECRET)) {
        logger.ok("Token is valid. Returning true ...");
        return true;
    }

    logger.ok("Token is invalid. Returning false ...");

    return false;
}

export default function handleAuth(message: ClientMessage, ws: WebSocket, req: IncomingMessage, logger: Logger, bot: Bot, msg: RawData) {
    let auth = message.payload as ClientAuth;

    if (!verifyToken(auth.token, logger.sublogger("verifyToken(auth.token)"))) {
        sendAuth({
            msgType: ServerAuthMessageType.AuthFailed
        } as ServerAuth, ws);
        return;
    }

    logger.verbose("Checking ClientAuthMessageType ...");

    if (auth.msgType === ClientAuthMessageType.LoginRequest) {
        logger.log("ClientAuthMessageType is LoginRequest, generating session for socket ...");
        sendAuth({
            msgType: ServerAuthMessageType.LoginSuccess,
            session_id: beginSession(auth.token, ws, req)
        } as ServerAuth, ws);

    } else if (auth.msgType === ClientAuthMessageType.LogoutRequest && message.sessionId) {
        if (!validateSession(ws, req, message.sessionId))
            throw new Error("Invalid session ID or IP mismatch! Cannot service the request.");

        logger.log("ClientAuthMessageType is LogoutRequest, terminating all sessions/sockets for this token ...");

        sendAuth({
            msgType: ServerAuthMessageType.LogoutSuccess
        } as ServerAuth, ws);

        endAllSessions(auth.token);
    } else {
        logger.log("ClientAuthMessageType is invalid, sending AuthFailed ...");

        sendAuth({
            msgType: ServerAuthMessageType.AuthFailed
        } as ServerAuth, ws);

        endSessionByIp(req);
    }
}