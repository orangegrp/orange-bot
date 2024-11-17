import { Message } from "discord.js";
import { AssistantCore } from "../openai/assistant_core.js";
import { sleep } from "orange-common-lib";

class OraChat extends AssistantCore {
    private chat_map: Map<string, string[]> = new Map();
    private thread_lock: Map<string, boolean> = new Map();
    constructor(assistant_id: string, model: string = "gpt-4o-mini") {
        super("ora_chat", assistant_id, model);
    }
    private async waitForThread(thread_id: string) {
        if (this.thread_lock.has(thread_id)) {
            while (this.thread_lock.has(thread_id)) await sleep(Math.round(Math.random() * 100));
        }
    }
    private async getChatByThreadId(thread_id: string) {
        const thread = await super.getExistingThread(thread_id);
        if (!thread) return false;
        return thread.id;
    }
    getChatByMessageId(message_id: string) {
        for (const [thread_id, message_ids] of this.chat_map) {
            if (message_ids.includes(message_id)) {
                return thread_id;
            }
        }
        return false;
    }
    async updateChatMap(thread_id: string, message_id: string) {
        const message_ids = this.chat_map.get(thread_id);
        if (!message_ids) return;
        message_ids.push(message_id);
        this.chat_map.set(thread_id, message_ids);
    }
    async newChat(message: Message | undefined = undefined, prependMessage: boolean = false, isBot: boolean = false) {
        const thread = await super.createNewThread();
        if (!thread) return false;
        if (message) {
            if (prependMessage) {
                await this.waitForThread(thread.id);
                const messageData = {
                    messageAuthor: isBot ? "(You wrote this Ora)" : `User with ID: <@${message.author.id}> Name: ${message.author.displayName}`,
                    messageText: message.content,
                    discordEmbeds: [
                        message.embeds.map(e => {
                            return {
                                title: e.title,
                                description: e.description,
                                url: e.url,
                                fields: e.fields.map(f => {
                                    return {
                                        name: f.name,
                                        value: f.value
                                    }
                                }),
                                footerText: e.footer?.text,
                                author: e.author?.name,
                            }
                        })
                    ]
                }
                const prompt = `The user who is going to speak to you next has replied to a previous message, below is the information (in JSON) about that message:\n\`\`\`${JSON.stringify(messageData)}\`\`\``;
                if (message.attachments.size > 0) {
                    const message_part = await super.createMultiModalThreadMessage(thread.id, prompt, message.attachments.map(a => a.url));
                    if (!message_part) return false;
                } else {
                    const message_part = await super.createThreadMessage(thread.id, prompt);
                    if (!message_part) return false;
                }
            }
            this.chat_map.set(thread.id, [message.id]);
        } else {
            this.chat_map.set(thread.id, []);
        }
        return thread.id;
    }
    async getChat(thread_id_or_message_id: string) {
        return this.getChatByThreadId(thread_id_or_message_id) || this.getChatByMessageId(thread_id_or_message_id);
    }
    async sendMessage(thread_id: string, message: Message, prompt: string = `User: "{{message.author.username}}" with the ID: <@{{message.author.id}}>, said:\n\n{{message.content}}`) {
        const thread = await super.getExistingThread(thread_id);
        if (!thread) return false;
        message.mentions.users.forEach(m => message.content = message.content.replace(`<@${m.id}>`, m.displayName));
        const text_prompt = prompt.replace("{{message.author.username}}", message.author.displayName)
            .replace("{{message.author.id}}", message.author.id)
            .replace("{{message.content}}", message.content);
        console.log(text_prompt);
        await this.waitForThread(thread.id);
        if (message.attachments.size > 0 && message.content) {
            const message_parts = await super.createMultiModalThreadMessage(thread.id, text_prompt, message.attachments.map(a => a.url));
            if (!message_parts) return false;
            await this.updateChatMap(thread.id, message.id);
            return message_parts.map(m => m.id);
        } else {
            const message_part = await super.createThreadMessage(thread.id, text_prompt);
            if (!message_part) return false;
            await this.updateChatMap(thread.id, message.id);
            return [message_part.id];
        }
    }
    async replyToMessage(thread_id: string, message: Message, replyTarget: Message, prompt: string = `User: \"{{message.author.username}}\" with the ID: <@{{message.author.id}}>, replying to "{{replyTarget}}" who said "{{replyContent}}", said:\n\n{{message.content}}`) {
        const text_prompt = prompt.replace("{{replyTarget}}", replyTarget.author.displayName).replace("{{replyContent}}", replyTarget.content);
        return this.sendMessage(thread_id, message, text_prompt);
    }
    async runChat(thread_id: string) {
        const thread = await super.getExistingThread(thread_id);
        if (!thread) return false;
        await this.waitForThread(thread.id);
        this.thread_lock.set(thread.id, true);
        const run = await super.runThread(thread.id);
        if (!run) return false;
        return run.id;
    }
    async waitForChat(thread_id: string, run_id: string, typingIndicatorFunction: Function | undefined = undefined) {
        let run = await super.getThreadRun(thread_id, run_id);
        for (let i = 0; i < 600; i++) {
            run = await super.getThreadRun(thread_id, run_id);
            if (typingIndicatorFunction) typingIndicatorFunction();
            
            if (!run) { await sleep(100); continue; }

            this.logger.verbose(`Thread run status: ${run.status} ${run.last_error} ${run.incomplete_details?.reason}`);

            if (run.status === "in_progress" || run.status === "queued") await sleep(100);
            else break;
        }
        if (this.thread_lock.has(thread_id)) this.thread_lock.delete(thread_id);
        if (!run) return false;
        return run;
    }
    async getChatMessage(thread_id: string) {
        const messages = await super.getThreadMessages(thread_id);
        if (!messages || messages.data.length < 1) return false;
        const lastMessage = messages.data[0];
        if (lastMessage.role !== "assistant") return false;
        return lastMessage;
    }
}

export { OraChat };