import type { Bot } from "orange-bot-base";
import { WebSocketServer } from "ws";

const wssV1 = new WebSocketServer( { port: 3002, path: "/remote/v1" } );

export default function(bot: Bot) {
    wssV1.on("connection", ws => {
        ws.on("message", msg => {
            
        });
    });
}