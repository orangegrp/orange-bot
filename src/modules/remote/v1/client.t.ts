type ClientMessage = { 
    msgId: string,
    version: string,
    msgType: ClientMessageType,
    payload: ClientPayload
};

enum ClientMessageType {
    ClientHelloRequest,
    ClientAuth,
    ClientSessionInfo,
    ClientDataRequest,
    ClientStatusRequest,
    ClientError
};

type ClientPayload = ClientHelloRequest | ClientAuth | ClientSessionInfo | ClientDataRequest | ClientStatusRequest | ClientError;

type ClientHelloRequest = {};

type ClientAuth = { 
    msgType: ClientAuthMessageType,
    token?: string
};

enum ClientAuthMessageType {
    LoginRequest,
    LogoutRequest
};

type ClientSessionInfo = {
    msgType: ClientSessionMessageType,
    payload: ClientSessionPayload
};

enum ClientSessionMessageType {
    SessionBegin,
    SessionExtend,
    SessionEnd
};

type ClientSessionPayload = {
    current_session_id?: string,
    token: string
};

type ClientDataRequest = { 
    msgType: ClientDataMessageType,
    payload: ClientDataPayload
};

enum ClientDataMessageType {
    DataFetchDiscord,
    DataFetchSystemConfig,
    DataFetchUserConfig
};

type ClientDataPayload = any;

type ClientStatusRequest = {
    msgId: string
};

type ClientError = {
    message: string,
    error?: Error
};