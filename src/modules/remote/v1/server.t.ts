type ServerMessage = { 
    version: string,
    msgType: ServerMessageType,
    payload: ServerPayload
};

enum ServerMessageType {
    ServerHelloReply,
    ServerAuth,
    ServerSessionInfo,
    ServerDataReply,
    ServerStatusReply,
    ServerError
};

type ServerPayload = ServerHelloReply | ServerAuth | ServerSessionInfo | ServerDataReply | ServerStatusReply | ServerError;

type ServerHelloReply = {};

type ServerAuth = { 
    msgType: ServerAuthMessageType,
    session_id: string
};

enum ServerAuthMessageType {
    LoginSuccess,
    LogoutSuccess,
    LoginFailed,
    LogoutFailed
};

type ServerSessionInfo = {
    msgType: ServerSessionMessageType,
    payload: ServerSessionPayload
};

enum ServerSessionMessageType {
    SessionBeginSuccess,
    SessionBeginFailed,
    SessionExtendSuccess,
    SessionExtendFailed,
    SessionEndSuccess,
    SessionEndFailed
};

type ServerSessionPayload = {
    old_session_id?: string,
    new_session_id?: string,
    renew_in?: number
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