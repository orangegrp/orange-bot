type ServerMessage = { 
    version: string,
    msgType: ServerMessageType,
    payload: ServerPayload
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
    success: boolean,
    message: string,
    payload?: ServerDataReply
};

type ServerError = {
    message: string,
    error?: Error
};