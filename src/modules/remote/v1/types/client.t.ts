type ClientMessage = { 
    sessionId?: string,
    version: string,
    msgType: ClientMessageType,
    payload?: ClientPayload
};

enum ClientMessageType {
    ClientHelloRequest,
    ClientAuth,
    ClientDataRequest,
    ClientStatusRequest,
    ClientError
};

type ClientPayload = ClientHelloRequest | ClientAuth | ClientDataRequest | ClientStatusRequest;

type ClientHelloRequest = {};

type ClientAuth = { 
    msgType: ClientAuthMessageType,
    token: string
};

enum ClientAuthMessageType {
    LoginRequest,
    LogoutRequest
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
    reqId: string
};

export { ClientMessage, ClientMessageType, ClientPayload, ClientHelloRequest, ClientAuth, ClientAuthMessageType, ClientDataRequest, ClientDataMessageType, ClientDataPayload, ClientStatusRequest };