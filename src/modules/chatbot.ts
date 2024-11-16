import { Bot, Module } from "orange-bot-base";
import { getLogger } from "orange-common-lib";
import { OraChat } from "./ora-intelligence/core/ora_chat.js";

const logger = getLogger("Ora Chat");

export default async function (bot: Bot, module: Module) {
    const oraChat = new OraChat("asst_c053PWqAKmuUgJ0whEjGpJzG");

    bot.client.on("messageCreate", async msg => {
        //if (!module.handling) return;
        if (!bot.client.user) return;
        if (msg.author.bot) return;
        if (msg.author.id === bot.client.user.id) return;

        async function runChat(thread_id: string) {
            await msg.channel.sendTyping();
            const thread = await oraChat.getChat(thread_id);
            if (!thread) return false;
            await msg.channel.sendTyping();
            if (!msg.reference?.messageId || (await msg.channel.messages.fetch(msg.reference.messageId)).author.id === bot.client.user?.id) {
                const message = await oraChat.sendMessage(thread, msg);
                if (!message) return false;
            } else {
                const replyTarget = await msg.channel.messages.fetch(msg.reference.messageId);
                const message = await oraChat.replyToMessage(thread, msg, replyTarget);
                if (!message) return false;
            }
            await msg.channel.sendTyping();
            const run = await oraChat.runChat(thread);
            if (!run) return false;
            await msg.channel.sendTyping();
            const run_result = await oraChat.waitForChat(thread, run, async () => await msg.channel.sendTyping());
            if (!run_result) return false; 
            await msg.channel.sendTyping();
            const chatMessage = await oraChat.getChatMessage(thread);
            if (!chatMessage) return false;
            const reply = await msg.reply(chatMessage.content.filter(t => t.type === "text").map(t => t.text.value).join("\n"));
            await oraChat.updateChatMap(thread, reply.id);
        }

        if (msg.content.startsWith(`<@${bot.client.user.id}>`)) {
            const thread_id = await oraChat.newChat(msg);
            console.log(thread_id);
            if (!thread_id) return; 
            await runChat(thread_id);
        } else if (msg.reference?.messageId) {
            const thread_id = oraChat.getChatByMessageId(msg.reference.messageId);
            if (!thread_id) return;
            await runChat(thread_id);
        }
    });
}