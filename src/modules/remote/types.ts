type RemoteMessage = { 
    version: string,
    msgType: RemoteMessageType,
    payload: RemotePayload
};

type RemotePayload = HelloMessage | SessionMessage | AuthMessage | DataMessage;

enum RemoteMessageType {
    Hello,
    Auth,
    Session,
    Data
};

enum AuthOperation {
    Login,
    Logout
};

enum SessionOperation {
    Begin,
    Extend,
    End
};

enum DataOperation {
    Get,
    Head,
    Post,
    Put,
    Delete,
    Patch
};

type HelloMessage = { };

type SessionMessage = {
    session_id: string,
    operation: SessionOperation
};

type AuthMessage = {
    token: string,
    operation: AuthOperation
};

enum DataTarget {
    SystemConfig,
    UserConfig,
    Discord
};

type DataPayload = {
    payload: any
    target: DataTarget
};

type DataMessage = {
    payload: DataPayload
    operation: DataOperation
};