type ServerMessage = { 
    version: string,
    msgType: ServerMessageType,
    payload: ServerPayload
};

enum ServerMessageType {
    HelloReply,
    Authentication,
    SessionInfo,
    DataReply,
    StatusReply
};

type ServerPayload = HelloReply | Authentication | SessionInfo | DataReply | StatusReply | ServerError;

type HelloReply = {};

type Authentication = { 
    msgType: AuthMessageType,
    session_id: string
};

enum AuthMessageType {
    LoginSuccess,
    LogoutSuccess,
    LoginFailed,
    LogoutFailed
};

type SessionInfo = {
    msgType: SessionMessageType,
    payload: SessionPayload
};

enum SessionMessageType {
    SessionBeginSuccess,
    SessionBeginFailed,
    SessionExtendSuccess,
    SessionExtendFailed,
    SessionEndSuccess,
    SessionEndFailed
};

type SessionPayload = {
    old_session_id?: string,
    new_session_id?: string,
    renew_in?: number
};

type DataReply = { 
    status: StatusReply,
    msgType: DataMessageType,
    payload: DataPayload
};

enum DataMessageType {
    DataFetchDiscord,
    DataFetchSystemConfig,
    DataFetchUserConfig
};

type DataPayload = any;

type StatusReply = {
    success: boolean,
    message: string,
    payload?: DataReply
};

type ServerError = {
    message: string,
    error?: Error
};