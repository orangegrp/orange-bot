type ServerMessage = { 
    version: string,
    msgType: ServerMessageType,
    payload?: ServerPayload
};

enum ServerMessageType {
    ServerHelloReply,
    ServerAuth,
    ServerDataReply,
    ServerStatusReply,
    ServerError
};

type ServerPayload = ServerHelloReply | ServerAuth | ServerDataReply | ServerStatusReply | ServerError;

type ServerHelloReply = null;

type ServerAuth = { 
    msgType: ServerAuthMessageType,
    session_id?: string
};

enum ServerAuthMessageType {
    LoginSuccess,
    LogoutSuccess,
    AuthFailed
};

type ServerDataReply = { 
    status: ServerStatusReply,
    reqId: string,
    msgType: ServerDataMessageType,
    payload: ServerDataPayload
};

enum ServerDataMessageType {
    DataFetchDiscord,
    DataFetchSystemConfig,
    DataFetchUserConfig
};

type ServerDataPayload = any;

type ServerStatusReply = {
    status: ServerStatus,
    reqId: string,
    payload?: ServerDataReply
};

enum ServerStatus {
    Success,
    Fail,
    Waiting
};

type ServerError = {
    message: string,
    error?: Error
};

export { ServerMessage, ServerMessageType, ServerPayload, ServerHelloReply, ServerAuth, ServerAuthMessageType, ServerDataReply, ServerDataMessageType, ServerStatus, ServerDataPayload, ServerStatusReply, ServerError };