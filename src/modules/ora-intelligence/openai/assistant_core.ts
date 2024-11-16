import OpenAI from "openai";
import { environment, getLogger } from "orange-common-lib";

class AssistantCore {
    private readonly logger;
    private readonly openai;
    private readonly assistant_id;
    private readonly model;
    constructor(for_module: string, assistant_id: string, model: string = "gpt-4o-mini") {
        this.logger = getLogger("Ora Intelligence").sublogger(`assistants_api for ${for_module}`);
        this.logger.log(`Initializing...`);
        if (environment.OPENAI_KEY) {
            this.logger.verbose(`Initializing OpenAI object...`);
            this.openai = new OpenAI({ apiKey: environment.OPENAI_KEY });
            this.logger.ok(`OpenAI object initialized!`);
        } else {
            this.logger.warn(`OpenAI key not found!`);
            this.openai = undefined;
        }
        this.assistant_id = assistant_id;
        this.model = model;
    }

    async createNewThread() {
        if (!this.openai) return undefined;
        this.logger.verbose(`Creating new thread...`);
        const thread = await this.openai.beta.threads.create();
        if (!thread) return undefined;
        this.logger.ok(`Thread created!, ID: ${thread.id}`);
        return thread;
    }
    async getExistingThread(thread_id: string) {
        if (!this.openai) return undefined;
        this.logger.verbose(`Getting existing thread...`);
        const thread = await this.openai.beta.threads.retrieve(thread_id);
        if (!thread) return undefined;
        this.logger.ok(`Thread retrieved!, ID: ${thread.id}`);
        return thread;
    }
    async getThreadMessages(thread_id: string) {
        if (!this.openai) return undefined;
        this.logger.verbose(`Getting thread messages...`);
        const messages = await this.openai.beta.threads.messages.list(thread_id);
        if (!messages) return undefined;
        this.logger.ok(`Thread messages retrieved! ID: ${thread_id}`);
        return messages;
    }
    async createThreadMessage(thread_id: string, message_text: string) {
        if (!this.openai) return undefined;
        this.logger.verbose(`Creating thread message in thread ${thread_id}...`);
        const message = await this.openai.beta.threads.messages.create(thread_id, { role: "user", content: [{ type: "text", text: message_text }] });
        if (!message) return undefined;
        this.logger.ok(`Thread message created in thread ${thread_id}! Msg ID: ${message.id}`);
        return message;
    }
    async createImageThreadMessage(thread_id: string, image_urls: string[]) {
        if (!this.openai) return undefined;
        this.logger.verbose(`Creating image thread message in thread ${thread_id}...`);
        const message = await this.openai.beta.threads.messages.create(thread_id, {
            role: "user",
            content: image_urls.map(img_url => ({ type: "image_url", image_url: { url: img_url } }))
        });
        if (!message) return undefined;
        this.logger.ok(`Image thread message created in thread ${thread_id}! Msg ID: ${message.id}`);
        return message;
    }
    async createMultiModalThreadMessage(thread_id: string, message_text: string, image_urls: string[]) {
        const text_part = await this.createThreadMessage(thread_id, message_text);
        if (!text_part) return undefined;
        const image_part = await this.createImageThreadMessage(thread_id, image_urls);
        if (!image_part) return undefined;
        return [text_part, image_part];
    }
    async runThread(thread_id: string, assistant_id: string = this.assistant_id, model: string = this.model) {
        if (!this.openai) return undefined;
        this.logger.verbose(`Running thread ${thread_id} against assistant ${assistant_id} ...`);
        const result = await this.openai.beta.threads.runs.create(thread_id,
            { assistant_id: assistant_id, model: model }
        );
        if (!result) return undefined;
        this.logger.ok(`Thread run! ID: ${thread_id}`);
        return result;
    }
    async getThreadRun(thread_id: string, run_id: string) {
        if (!this.openai) return undefined;
        this.logger.verbose(`Getting thread run ${run_id} for thread ${thread_id}...`);
        const result = await this.openai.beta.threads.runs.retrieve(thread_id, run_id);
        if (!result) return undefined;
        this.logger.ok(`Thread run retrieved! ID: ${run_id}`);
        return result;
    }
}

export { AssistantCore }