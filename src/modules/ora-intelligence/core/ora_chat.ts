import { Message } from "discord.js";
import { AssistantCore } from "../openai/assistant_core.js";
import { sleep } from "orange-common-lib";
import { Run } from "openai/resources/beta/threads/runs/runs.js";
import { ToolCallsStepDetails } from "openai/resources/beta/threads/runs/steps.js";
import { performWebSearch } from "./web_search.js";

class OraChat extends AssistantCore {
    private chat_map: Map<string, string[]> = new Map();
    private thread_lock: Map<string, boolean> = new Map();
    constructor(assistant_id: string, model: string = "gpt-4o-mini") {
        super("ora_chat", assistant_id, model);
    }
    private async waitForThread(thread_id: string) {
        if (this.thread_lock.has(thread_id)) {
            while (this.thread_lock.has(thread_id)) { await sleep(Math.round(Math.random() * 100)); }
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
    async addExistingMessageToThread(thread_id: string, message: Message | undefined = undefined, isBot: boolean = false) {
        if (!message) return false;
        await this.waitForThread(thread_id);
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
            const message_part = await super.createMultiModalThreadMessage(thread_id, prompt, message.attachments.map(a => a.url));
            if (!message_part) return false;
        } else {
            const message_part = await super.createThreadMessage(thread_id, prompt);
            if (!message_part) return false;
        }
    }
    async newChat(message: Message | undefined = undefined, prependMessage: boolean = false, isBot: boolean = false) {
        const thread = await super.createNewThread();
        if (!thread) return false;
        if (message) {
            if (prependMessage) {
                await this.waitForThread(thread.id);
                await this.addExistingMessageToThread(thread.id, message, isBot);
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
    async sendMessage(thread_id: string, message: Message, prompt: string = `The current time is: {{current_time}}\nUser: "{{message.author.username}}" with the ID: <@{{message.author.id}}>, said:\n\n{{message.content}}`) {
        const thread = await super.getExistingThread(thread_id);
        if (!thread) return false;
        message.mentions.users.forEach(m => message.content = message.content.replace(`<@${m.id}>`, m.displayName));
        const text_prompt = prompt.replace("{{message.author.username}}", message.author.displayName)
            .replace("{{message.author.id}}", message.author.id)
            .replace("{{message.content}}", message.content )
            .replace("{{current_time}}", new Date().toISOString());
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
    async replyToMessage(thread_id: string, message: Message, replyTarget: Message, prompt: string = `The current time is: {{current_time}}\nUser: \"{{message.author.username}}\" with the ID: <@{{message.author.id}}>, replying to "{{replyTarget}}" who said "{{replyContent}}", said:\n\n{{message.content}}`) {
        const text_prompt = prompt.replace("\"{{replyTarget}}\"", replyTarget.client.user.id === replyTarget.author.id ? "(You, Ora)": `"${replyTarget.author.displayName}"`).replace("{{replyContent}}", replyTarget.content);
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
    async runTool(thread_id: string, run: Run | undefined = undefined) {
        const error_msg = "Tool call failed, tell the user there was a problem finding the relevant information.";
        if (!run || !this.openai) return false;
        const steps = await this.openai.beta.threads.runs.steps.list(thread_id, run.id);
        if (!steps) return false;

        this.logger.verbose(`Running tool...`);

        const tool_calls: { call_id: string, response: string }[] = [];
        for (const step of steps.data) {
            if (step.type !== "tool_calls" && step.step_details.type !== "tool_calls" && step.status !== "in_progress") continue;
            for (const tool_call of (step.step_details as ToolCallsStepDetails).tool_calls) {
                if (tool_calls.find(tc => tc.call_id === tool_call.id)) continue;
                if (tool_call.type !== "function") continue;
                switch (tool_call.function.name) {
                    case "web_search":
                        const json_data = JSON.parse(tool_call.function.arguments);
                        this.logger.verbose(`Running web search for query "${json_data.searchQuery}"...`);
                        tool_calls.push({ call_id: tool_call.id, response: JSON.stringify(await performWebSearch(json_data.searchQuery, json_data.region, json_data.searchType, json_data.freshness)) });
                        break;
                    default:
                        tool_calls.push({ call_id: tool_call.id, response: error_msg });
                        break;
                }
            }
        }

        return tool_calls;
    }
    async waitForChat(thread_id: string, run_id: string, typingIndicatorFunction: Function | undefined = undefined) {
        let run = await super.getThreadRun(thread_id, run_id);
        for (let i = 0; i < 600; i++) {
            run = await super.getThreadRun(thread_id, run_id);
            if (typingIndicatorFunction) typingIndicatorFunction();

            if (!run) { await sleep(100); continue; }

            this.logger.verbose(`Thread run status: ${run.status} ${run.last_error} ${run.incomplete_details?.reason}`);

            if (run.status === "in_progress" || run.status === "queued") await sleep(100);
            else if (run.status === "requires_action") {
                const toolResult = await this.runTool(thread_id, run);
                if (!toolResult) {
                    await this.openai!.beta.threads.runs.cancel(thread_id, run_id);
                    continue;
                }
                console.dir(toolResult);
                await this.openai!.beta.threads.runs.submitToolOutputs(
                    thread_id, run_id, {
                    tool_outputs:
                        toolResult.map(t => {
                            return {
                                tool_call_id: t.call_id,
                                output: `{
                                    "currentTime": "${new Date().toISOString()}",
                                    "instructions": "This is a response to a tool call. When generating your response you must NOT embed any links using the traditional markdown format eg \"![text](https://example.com)\", instead you must omit the exclamation point and present it like this \"[text](https://example.com)\", this will ensure that the link is not broken. YOU MUST FOLLOW THIS RULE OTHERWISE PENALTIES WILL APPLY.",
                                    "data": ${t.response}
                                }`
                            }
                        })
                });
            }
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