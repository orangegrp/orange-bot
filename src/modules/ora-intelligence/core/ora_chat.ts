import { Message } from "discord.js";
import { AssistantCore } from "../openai/assistant_core.js";
import { sleep } from "orange-common-lib";
import { Run } from "openai/resources/beta/threads/runs/runs.js";
import { ToolCallsStepDetails } from "openai/resources/beta/threads/runs/steps.js";
import { performWebSearch } from "./web_search.js";

class OraChat extends AssistantCore {
    private chat_map: Map<string, string[]> = new Map();
    private thread_lock: Map<string, boolean> = new Map();
    /**
     * Creates a new OraChat object.
     *
     * @param assistant_id - The ID of the AI assistant to use.
     * @param model - The model to use for the AI assistant. Defaults to "gpt-4o-mini".
     */
    constructor(assistant_id: string, model: string = "gpt-4o-mini") {
        super("ora_chat", assistant_id, model);
    }
    /**
     * Waits until a thread is no longer locked. If the thread is locked, it waits a random amount of time (between 0 and 100ms) before trying again.
     * @param thread_id - The ID of the thread to wait for.
     */
    private async waitForThread(thread_id: string) {
        if (this.thread_lock.has(thread_id)) {
            while (this.thread_lock.has(thread_id)) { await sleep(Math.round(Math.random() * 100)); }
        }
    }
    /**
     * Retrieves the chat ID associated with a given thread ID.
     *
     * @param thread_id - The ID of the thread to search for.
     * @returns - The ID of the thread if it exists, or false if it does not.
     */
    private async getChatByThreadId(thread_id: string) {
        const thread = await super.getExistingThread(thread_id);
        if (!thread) return false;
        return thread.id;
    }
    /**
     * Retrieves the thread ID associated with a given message ID.
     *
     * @param message_id - The ID of the message to search for.
     * @returns - The ID of the thread if it exists, or false if it does not.
     */
    getChatByMessageId(message_id: string) {
        for (const [thread_id, message_ids] of this.chat_map) {
            if (message_ids.includes(message_id)) {
                return thread_id;
            }
        }
        return false;
    }
    /**
     * Updates the chat map with the given message ID.
     * @param thread_id - The ID of the thread to update.
     * @param message_id - The ID of the message to add to the thread.
     * @returns - True if the update was successful, false otherwise.
     */
    async updateChatMap(thread_id: string, message_id: string) {
        const message_ids = this.chat_map.get(thread_id);
        if (!message_ids) return false;
        message_ids.push(message_id);
        this.chat_map.set(thread_id, message_ids);
        return true;
    }
    /**
     * Adds an existing message to the thread with the given ID.
     * @param thread_id - The ID of the thread to add the message to.
     * @param message - The message to add to the thread. If not provided, the function does nothing.
     * @param isBot - Whether the message is from a bot or a user. Defaults to false.
     * @returns - True if the message was successfully added, false otherwise.
     */
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
        return this.updateChatMap(thread_id, message.id);
    }
    /**
     * Creates a new chat with the given message.
     *
     * @param message - The message to send in the chat. If not provided, the chat will be empty.
     * @param prependMessage - Whether to prepend the message to the chat. If the message is not provided, this option is ignored.
     * @param isBot - Whether the message is from a bot or a user. Defaults to false.
     * @returns - The ID of the new chat, or false if the operation fails.
     */
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
    /**
     * Retrieves the chat associated with the given ID. If the ID is a message ID, it will be converted to a thread ID first.
     * @param thread_id_or_message_id - The ID of the thread or message to retrieve the chat for.
     * @returns - The ID of the chat, or false if the operation fails.
     */
    async getChat(thread_id_or_message_id: string) {
        return this.getChatByThreadId(thread_id_or_message_id) || this.getChatByMessageId(thread_id_or_message_id);
    }
    /**
     * Sends a message to the AI assistant.
     * @param thread_id - The ID of the thread to send the message to.
     * @param message - The message to send.
     * @param prompt - A prompt string to use when sending the message. The string should contain placeholders for the message's author and content, and may also contain placeholders for the current time. The placeholders should be in the format `{{placeholder_name}}`.
     * @returns - The ID of the message, or false if the operation fails.
     */
    async sendMessage(thread_id: string, message: Message, prompt: string = `The current time is: {{current_time}}\nUser: "{{message.author.username}}" with the ID: <@{{message.author.id}}>, said:\n\n{{message.content}}`) {
        const thread = await super.getExistingThread(thread_id);
        if (!thread) return false;
        message.mentions.users.forEach(m => message.content = message.content.replace(`<@${m.id}>`, m.displayName));
        const text_prompt = prompt.replace("{{message.author.username}}", message.author.displayName)
            .replace("{{message.author.id}}", message.author.id)
            .replace("{{message.content}}", message.content)
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
    /**
     * Sends a reply message to the AI assistant within a specified thread.
     *
     * @param thread_id - The ID of the thread to send the reply in.
     * @param message - The message containing the reply content to send.
     * @param replyTarget - The original message being replied to.
     * @param prompt - A prompt string to use for the reply message, with placeholders for current time, author, and content.
     * @returns - An array of the IDs of the sent message parts, or false if the operation fails.
     */
    async replyToMessage(thread_id: string, message: Message, replyTarget: Message, prompt: string = `The current time is: {{current_time}}\nUser: \"{{message.author.username}}\" with the ID: <@{{message.author.id}}>, replying to "{{replyTarget}}" who said "{{replyContent}}", said:\n\n{{message.content}}`) {
        const text_prompt = prompt.replace("\"{{replyTarget}}\"", replyTarget.client.user.id === replyTarget.author.id ? "(You, Ora)" : `"${replyTarget.author.displayName}"`).replace("{{replyContent}}", replyTarget.content);
        return this.sendMessage(thread_id, message, text_prompt);
    }
    /**
     * Starts a new AI run in the given thread.
     * @param thread_id - The ID of the thread to run the AI in.
     * @returns - The ID of the run, or false if the operation fails.
     */
    async runChat(thread_id: string) {
        const thread = await super.getExistingThread(thread_id);
        if (!thread) return false;
        await this.waitForThread(thread.id);
        this.thread_lock.set(thread.id, true);
        const run = await super.runThread(thread.id);
        if (!run) return false;
        return run.id;
    }
    async runChatStreamed(thread_id: string) {
        const thread = await super.getExistingThread(thread_id);
        if (!thread) return false;
        await this.waitForThread(thread.id);
        this.thread_lock.set(thread.id, true);
        const stream = await super.runThreadStreamed(thread.id);
        if (!stream) return false;
        for await (const event of stream) {
            if (event.event === "thread.run.completed") {
                this.logger.ok(`Thread run! ID: ${thread_id}`);
                if (this.thread_lock.has(thread_id)) this.thread_lock.delete(thread_id);
                return await this.getChatMessage(thread_id);
            }
        }
        return undefined;
    }
    /**
     * Runs a tool on a given thread. If no run is specified, the most recent run is used.
     * @param thread_id - The ID of the thread to run the tool on.
     * @param run - The run to target. If not specified, the most recent run is used.
     * @returns An array of tool call results. Each result is an object with a call_id and a response. The call_id is the ID of the tool call, and the response is the JSON response from the tool. If there is an error running the tool, the response will be a string containing the error message.
     */
    async runTool(thread_id: string, run: Run | undefined = undefined) {
        if (!run || !this.openai) return false;

        const steps = await this.openai.beta.threads.runs.steps.list(thread_id, run.id);
        if (!steps) return false;

        this.logger.verbose(`Running tool...`);
        const tool_calls: { call_id: string, response: string }[] = [];

        for (const step of steps.data) {
            if (step.type !== "tool_calls" && step.step_details.type !== "tool_calls" && step.status !== "in_progress") continue;

            for (const tool_call of (step.step_details as ToolCallsStepDetails).tool_calls) {
                if (tool_calls.find(tc => tc.call_id === tool_call.id) || tool_call.type !== "function") continue;

                switch (tool_call.function.name) {
                    case "web_search":
                        const search_params = JSON.parse(tool_call.function.arguments);
                        this.logger.verbose(`Running web search for query "${search_params.searchQuery}"...`);
                        tool_calls.push({ call_id: tool_call.id, response: JSON.stringify(await performWebSearch(search_params.searchQuery, search_params.region, search_params.searchType, search_params.freshness)) });
                        break;
                    default:
                        tool_calls.push({ call_id: tool_call.id, response: "Tool call failed, tell the user there was a problem finding the relevant information." });
                        break;
                }
            }
        }

        return tool_calls;
    }
    /**
     * Waits for a thread to complete by repeatedly checking its status.
     * @param thread_id - The ID of the thread to wait for.
     * @param run_id - The ID of the run to check the status of.
     * @param typingIndicatorFunction - An optional function to indicate typing status during the wait.
     * @returns - The completed run object, or false if the run fails to complete.
     */
    async waitForChat(thread_id: string, run_id: string, typingIndicatorFunction: Function | undefined = undefined) {
        let run = await super.getThreadRun(thread_id, run_id);
        for (let i = 0; i < 600; i++) {
            run = await super.getThreadRun(thread_id, run_id);
            if (typingIndicatorFunction) typingIndicatorFunction();

            if (!run) { await sleep(500); continue; }

            this.logger.verbose(`Thread run status: ${run.status} ${run.last_error} ${run.incomplete_details?.reason}`);

            if (run.status === "in_progress" || run.status === "queued") await sleep(1000);
            else if (run.status === "requires_action") {
                const toolResult = await this.runTool(thread_id, run);
                if (!toolResult) {
                    await this.openai!.beta.threads.runs.cancel(thread_id, run_id);
                    continue;
                }
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
    /**
     * Gets the latest message from the OpenAI chat thread.
     * 
     * @param thread_id - The ID of the thread to retrieve the message from.
     * @returns - The latest message from the thread, or false if the operation fails.
     */

    async getChatMessage(thread_id: string) {
        const messages = await super.getThreadMessages(thread_id);
        if (!messages || messages.data.length < 1) return false;
        const lastMessage = messages.data[0];
        if (lastMessage.role !== "assistant") return false;
        return lastMessage;
    }
}

export { OraChat };