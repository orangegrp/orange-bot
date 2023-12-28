import type { Bot } from "orange-bot-base";
import { WebSocketServer } from "ws";

const wssV1 = new WebSocketServer( { port: 3002, path: "/remote/v1" } );

export default function(bot: Bot) {
    wssV1.on("connection", ws => {
        ws.on("message", msg => {
            let message: RemoteMessage = JSON.parse(msg.toString());
            switch (message.msgType) {
                case RemoteMessageType.Auth:
                    let auth = message.payload as AuthMessage;
                    switch (auth.operation) {
                        case AuthOperation.Login:
                            break;
                        case AuthOperation.Logout:
                            break;
                    }
                    break;
                case RemoteMessageType.Session:
                    let session = message.payload as SessionMessage;
                    switch (session.operation) {
                        case SessionOperation.Begin:
                            break;
                        case SessionOperation.Extend:
                            break;
                        case SessionOperation.End:
                            break;
                    }
                    break;
                case RemoteMessageType.Data:
                    break;
                case RemoteMessageType.Hello:
                    ws.send(JSON.stringify({ msgType: RemoteMessageType.Hello } as RemoteMessage));
                    break;
                default:
                    ws.close();
                    break;
            }
        });
    });
}