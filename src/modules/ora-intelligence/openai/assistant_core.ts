import { environment, getLogger } from "orange-common-lib";
import OpenAI from "openai";

class AssistantCore {
    readonly logger;
    readonly openai;
    private readonly assistant_id;
    private readonly model;
    
    private thread_cache: Map<string, OpenAI.Beta.Threads.Thread> = new Map();
    thread_run_cache: Map<string, OpenAI.Beta.Threads.Runs.Run> = new Map();
    private preemptive_thread_pool: OpenAI.Beta.Threads.Thread[] = [];

    /**
     * Initialize an AssistantCore for a module.
     *
     * @param for_module - The name of the module.
     * @param assistant_id - The ID of the assistant to use.
     * @param model - The model to use. Defaults to "gpt-4o-mini".
     */
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

    /**
     * Creates a new thread in the background when the object is initialized.
     * The thread is stored in a pool of threads, and can be reused.
     * The method will not create a new thread if the pool already has 5 threads.
     * 
     * @returns - The newly created thread object, or undefined if the operation fails.
     */
    async createPreemptiveThread() {
        if (!this.openai) return undefined;
        if (this.preemptive_thread_pool.length > 5) return;
        this.logger.verbose(`Creating preemptive thread...`);
        const thread = await this.openai.beta.threads.create();
        if (!thread) return undefined;
        this.logger.ok(`Preemptive thread created!, ID: ${thread.id}`);
        if (thread.id) this.preemptive_thread_pool.push(thread);
        return thread;
    }
    
    /**
     * Creates a new thread and returns the thread object.
     *
     * @returns - The newly created thread object, or undefined if the operation fails.
     */
    async createNewThread() {
        if (!this.openai) return undefined;
        if (this.preemptive_thread_pool.length > 0) {
            this.logger.verbose(`Using preemptive thread...`);
            const thread = this.preemptive_thread_pool.pop();
            if (thread && thread.id) {
                this.thread_cache.set(thread.id, thread);
                setTimeout(() => this.thread_cache.delete(thread.id), 72 * 60 * 60 * 1000);
                return thread;
            }
            this.logger.warn(`Preemptive thread had no id, falling back!`);
        }
        this.logger.verbose(`Creating new thread...`);
        const thread = await this.openai.beta.threads.create();
        if (!thread) return undefined;
        this.logger.ok(`Thread created!, ID: ${thread.id}`);
        if (thread.id) {
            this.thread_cache.set(thread.id, thread);
            setTimeout(() => this.thread_cache.delete(thread.id), 72 * 60 * 60 * 1000);
        }
        return thread;
    }

    /**
     * Retrieves an existing thread and returns the thread object.
     *
     * @param thread_id - The ID of the thread to retrieve.
     * @returns - The retrieved thread object, or undefined if the operation fails.
     */
    private async _getExistingThread(thread_id: string) {
        if (!this.openai) return undefined;
        this.logger.verbose(`Getting existing thread...`);
        const thread = await this.openai.beta.threads.retrieve(thread_id);
        if (!thread) return undefined;
        this.logger.ok(`Thread retrieved!, ID: ${thread.id}`);
        return thread;
    }
    /**
     * Retrieves an existing thread and returns the thread object.
     *
     * @param thread_id - The ID of the thread to retrieve.
     * @returns - The retrieved thread object, or undefined if the operation fails.
     */
    async getExistingThread(thread_id: string) {
        if (this.thread_cache.has(thread_id)) {
            this.logger.verbose(`Thread retrieved from cache! ID: ${thread_id}`);
            return this.thread_cache.get(thread_id);
        }
        const thread = await this._getExistingThread(thread_id);
        if (!thread) return undefined;
        this.thread_cache.set(thread_id, thread);
        setTimeout(() => this.thread_cache.delete(thread_id), 72 * 60 * 60 * 1000);
        return thread;
    }

    /**
     * Retrieves the messages of a thread.
     *
     * @param thread_id - The ID of the thread to retrieve messages from.
     * @returns - The list of messages, or undefined if the operation fails.
     */
    async getThreadMessages(thread_id: string) {
        if (!this.openai) return undefined;
        this.logger.verbose(`Getting thread messages...`);
        const messages = await this.openai.beta.threads.messages.list(thread_id);
        if (!messages) return undefined;
        this.logger.ok(`Thread messages retrieved! ID: ${thread_id}`);
        return messages;
    }
    /**
     * Creates a new message in a thread and returns the created message object.
     *
     * @param thread_id - The ID of the thread to create the message in.
     * @param message_text - The text content of the message.
     * @returns - The created message object, or undefined if the operation fails.
     */
    async createThreadMessage(thread_id: string, message_text: string) {
        if (!this.openai) return undefined;
        this.logger.verbose(`Creating thread message in thread ${thread_id}...`);
        const message = await this.openai.beta.threads.messages.create(thread_id, { role: "user", content: [{ type: "text", text: message_text }] });
        if (!message) return undefined;
        this.logger.ok(`Thread message created in thread ${thread_id}! Msg ID: ${message.id}`);
        return message;
    }
    /**
     * Creates a new message in a thread with image content.
     *
     * @param thread_id - The ID of the thread to create the message in.
     * @param image_urls - A list of URLs pointing to the images to be sent.
     * @returns - The created message object, or undefined if the operation fails.
     */
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
    /**
     * Creates a new message in a thread with both text and image content.
     *
     * @param thread_id - The ID of the thread to create the message in.
     * @param message_text - The text content of the message.
     * @param image_urls - A list of URLs pointing to the images to be sent.
     * @returns - An array of the created text and image message objects, or undefined if the operation fails.
     */
    async createMultiModalThreadMessage(thread_id: string, message_text: string, image_urls: string[]) {
        const text_part = await this.createThreadMessage(thread_id, message_text);
        if (!text_part) return undefined;
        const image_part = await this.createImageThreadMessage(thread_id, image_urls);
        if (!image_part) return undefined;
        return [text_part, image_part];
    }

    /**
     * Starts a new thread run against an assistant and model.
     *
     * @param thread_id - The ID of the thread to run.
     * @param assistant_id - The ID of the assistant to use. Defaults to the assistant ID used when creating this object.
     * @param model - The model to use. Defaults to the model used when creating this object.
     * @returns - The created thread run object, or undefined if the operation fails.
     */
    async runThread(thread_id: string, assistant_id: string = this.assistant_id, model: string = this.model) {
        if (!this.openai) return undefined;
        this.logger.verbose(`Running thread ${thread_id} against assistant ${assistant_id} ...`);
        const result = await this.openai.beta.threads.runs.create(thread_id,
            { assistant_id: assistant_id, model: model }
        );
        if (!result) return undefined;
        this.thread_run_cache.set(result.id, result);
        setTimeout(() => this.thread_run_cache.delete(result.id), 10 * 60 * 1000);
        this.logger.ok(`Thread run! ID: ${thread_id}`);
        return result;
    }

    /**
     * Starts a new thread run against an assistant and model, and returns the event stream directly.
     *
     * @param thread_id - The ID of the thread to run.
     * @param assistant_id - The ID of the assistant to use. Defaults to the assistant ID used when creating this object.
     * @param model - The model to use. Defaults to the model used when creating this object.
     * @returns - The event stream of the thread run, or undefined if the operation fails.
     */
    async runThreadStreamed(thread_id: string, assistant_id: string = this.assistant_id, model: string = this.model) {
        if (!this.openai) return undefined;
        this.logger.verbose(`Running thread ${thread_id} against assistant ${assistant_id} (streamed) ...`);
        const stream = await this.openai.beta.threads.runs.create(thread_id,
            { assistant_id: assistant_id, model: model, stream: true }
        );
        if (!stream) return undefined;
        this.logger.ok(`Thread run! ID: ${thread_id}`);
        return stream;
    }
    
    /**
     * Retrieves a thread run.
     *
     * @param thread_id - The ID of the thread the run belongs to.
     * @param run_id - The ID of the run to retrieve.
     * @returns - The retrieved thread run object, or undefined if the operation fails.
     */
    async getThreadRun(thread_id: string, run_id: string) {
        if (!this.openai) return undefined;
        if (this.thread_run_cache.has(run_id)) {
            this.logger.verbose(`Thread run retrieved from cache! ID: ${run_id}}`);
            return this.thread_run_cache.get(run_id);
        }
        this.logger.verbose(`Getting thread run ${run_id} for thread ${thread_id}...`);
        const result = await this.openai.beta.threads.runs.retrieve(thread_id, run_id);
        if (!result) return undefined;
        this.logger.ok(`Thread run retrieved! ID: ${run_id}`);
        return result;
    }
}

export { AssistantCore }