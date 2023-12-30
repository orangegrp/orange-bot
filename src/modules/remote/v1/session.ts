import { getLogger } from "orange-common-lib";
import { WebSocket } from "ws";
import { IncomingMessage } from 'http';
import { randomBytes } from "crypto";
import { ClientDataRequest, ClientMessage } from "./types/client.t";

const activeSessions = new Map<string, LoginSession>();
const logger = getLogger("orange🟠 Bot").sublogger("Remote WS > Session Manager");

class LoginSession {
    private session_id: string;
    private token: string;
    private websocket: WebSocket;
    private original_request: IncomingMessage;

    public client_requests: Map<string, ClientDataRequest>;

    constructor(tokem: string, ws: WebSocket, req: IncomingMessage) {
        logger.verbose(`Creating new session for ${req.socket.remoteAddress} ...`);
        this.client_requests = new Map();
        this.token = tokem;
        this.websocket = ws;
        this.original_request = req;
        this.session_id = randomBytes(64).toString("hex");
    }

    public getSessionId(): string {
        return this.session_id;
    }
    public checkToken(token: string): boolean {
        logger.verbose(`Checking token for session verification ... Result: ${token === this.token ? 'Pass' : 'Fail'}`);
        return token === this.token; 
    }
    public checkIp(req: IncomingMessage): boolean {
        logger.verbose(`Checking IP address for session verification. Expecting ${this.original_request.socket.remoteAddress}, got ${req.socket.remoteAddress} ...`);
        return this.original_request.socket.remoteAddress === req.socket.remoteAddress;
    }
    
    public destroy(): void {
        logger.verbose(`Destroying session ${this.session_id} ...`);

        activeSessions.delete(this.session_id);
        this.websocket.close();
        this.original_request.destroy();
        this.token = "";
        this.session_id = "";
        
        logger.ok("Destroyed session.");
    }
}

function beginSession(token: string, ws: WebSocket, req: IncomingMessage, expiry: number = 604800000 /* 7 days */) {
    let session = new LoginSession(token, ws, req);
    activeSessions.set(session.getSessionId(), session);

    setTimeout(() => endSession(session.getSessionId()), expiry);
    return session.getSessionId();
}

function endSession(sessionId: string) {
    logger.verbose("endSession called.");
    let session = activeSessions.get(sessionId);
    if (session)
        session.destroy();
}

function endSessionByIp(req: IncomingMessage) {
    logger.verbose("endSessionByIp called.");
    activeSessions.forEach((session) => {
        if (session.checkIp(req))
            session.destroy();
    });
}

function endAllSessions(token: string) {
    logger.verbose("endAllSessions called.");
    activeSessions.forEach((session) => {
        if (session.checkToken(token))
            session.destroy();
    });
}

function validateSession(ws: WebSocket, req: IncomingMessage, sessionId: string | undefined) {
    logger.verbose("validateSession called.");
    if (!activeSessions.has(sessionId ?? ''))
        return false;

    let session = activeSessions.get(sessionId ?? '');

    if (!session)
        return false;
    if (!session.checkIp(req))
        return false;

    logger.verbose(`validation passed for ${req.socket.remoteAddress}`);

    return true;
}

function getSession(sessionId: string | undefined) {
    return activeSessions.get(sessionId || '');
}

export { beginSession, endSession, endSessionByIp, endAllSessions, validateSession, getSession };