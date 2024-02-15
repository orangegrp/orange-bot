import OpenAI from "openai";
import { sleep } from "orange-bot-base";
import { getLogger } from "orange-common-lib";
import util from "util";

var openai: OpenAI | undefined = undefined;

async function initialize() {
    if (process.env.OPENAI_KEY) {
        openai = new OpenAI({ apiKey: process.env.OPENAI_KEY});
    }
}

const logger = getLogger("openai");
const context_history_length = 10;

async function generate_with_context(thread_id: string, user_name: string, user_id: string, user_prompt: string, assistant_id: string): Promise<{ response?: string, thread_id?: string, input_tokens?: number, output_tokens?: number, new_context?: boolean }> {
    if (!openai) {
        await initialize();
        if (!openai) {
            return { response: undefined, thread_id: undefined, input_tokens: undefined, output_tokens: undefined, new_context: true };
        }
    }

    try {
        if (user_prompt.length > 100) {
            user_prompt = user_prompt.substring(0, 100);
            user_prompt += "\n\n[User input truncated to 100 characters]";
        }
        const chatThread = await openai.beta.threads.retrieve(thread_id);
        //logger.verbose(util.inspect(chatThread, { depth: null }));
        const threadMsgs = await openai.beta.threads.messages.list(chatThread.id,  { timeout: 5000 });    
        //logger.verbose(util.inspect(threadMsgs, { depth: null }));
        if (threadMsgs.data.length > context_history_length) {
            return generate_no_context(user_name, user_id, user_prompt, assistant_id);
        }
        const contextThreadMsgs = await openai.beta.threads.messages.create(
            chatThread.id,
            { role: "user", content: `User: "${user_name}" with ID: "${user_id}" said: \`\`\`${user_prompt}\`\`\`` },
            { timeout: 5000 }
        );
        //logger.verbose(util.inspect(contextThreadMsgs, { depth: null }));
        const threadRun = await openai.beta.threads.runs.create(
            chatThread.id,
            { assistant_id: assistant_id, model: "gpt-3.5-turbo-0125" },
            { timeout: 5000 }
        );
        //logger.verbose(util.inspect(threadRun, { depth: null }));
        let run_info = await openai.beta.threads.runs.retrieve(chatThread.id, threadRun.id, { timeout: 5000 });
        let counter: number = 0;
        while (true) {
            let status = run_info.status;
            logger.verbose(status);
            if (status === "completed") {
                break;
            } else if (status === "failed" || status === "cancelled") {
                return { response: undefined, thread_id: undefined, input_tokens: run_info.usage?.prompt_tokens, output_tokens: run_info.usage?.completion_tokens, new_context: false };
            } else if (counter === 3) {
                logger.warn(`Timeout reached, cancelling thread. Thread: ${chatThread.id} Run: ${threadRun.id}`);
                run_info = await openai.beta.threads.runs.retrieve(chatThread.id, threadRun.id, { timeout: 5000 });
                if (run_info.status === "in_progress")
                    await openai.beta.threads.runs.cancel(chatThread.id, threadRun.id);
                continue;
            }
            await sleep(1000);
            run_info = await openai.beta.threads.runs.retrieve(chatThread.id, threadRun.id, { timeout: 5000 });
            counter += 1;
        }

        const newThreadMessages = await openai.beta.threads.messages.list(
            chatThread.id, 
            { timeout: 5000 }
        );
        //logger.verbose(util.inspect(newThreadMessages, { depth: null }));
        var response: string[] = [];
        newThreadMessages.data.filter(d => d.role === "assistant").forEach((e) => {
            e.content.forEach((c) => {
                if (c.type === "text") {
                    response.push(c.text.value);
                }
            });
        });
        threadMsgs.data.filter(d => d.role === "assistant").forEach((e) => {
           e.content.forEach((c) => {
               if (c.type === "text") {
                    response.splice(response.findIndex(r => r === c.text.value), 1);    
               }
           });
        });

        return { response: response.join("\n\n"), thread_id: chatThread.id, input_tokens: run_info.usage?.prompt_tokens, output_tokens: run_info.usage?.completion_tokens, new_context: false };

    } catch (err: any) {
        logger.error(err);
        return { response: undefined, thread_id: undefined, input_tokens: undefined, output_tokens: undefined, new_context: false };
    }
}

async function generate_no_context(user_name: string, user_id: string, user_prompt: string, assistant_id: string): Promise<{ response?: string, thread_id?: string, input_tokens?: number, output_tokens?: number, new_context?: boolean }> {
    if (!openai) {
        await initialize();
        if (!openai) {
            return { response: undefined, thread_id: undefined, input_tokens: undefined, output_tokens: undefined, new_context: true };
        }
    }

    try {
        if (user_prompt.length > 100) {
            user_prompt = user_prompt.substring(0, 100);
            user_prompt += "\n\n[User input truncated to 100 characters]";
        }
        const chatThread = await openai.beta.threads.create( { timeout: 5000 });
        //logger.verbose(util.inspect(chatThread, { depth: null }));
        const threadMsgs = await openai.beta.threads.messages.create(
            chatThread.id,
            { role: "user", content: `User: "${user_name}" with ID: "${user_id}" said: \`\`\`${user_prompt}\`\`\`` },
            { timeout: 5000 }
        );
        //logger.verbose(util.inspect(threadMsgs, { depth: null }));
        const threadRun = await openai.beta.threads.runs.create(
            chatThread.id,
            { assistant_id: assistant_id, model: "gpt-3.5-turbo-0125" },
            { timeout: 5000 }
        );
        //logger.verbose(util.inspect(threadRun, { depth: null }));
        let run_info = await openai.beta.threads.runs.retrieve(chatThread.id, threadRun.id,  { timeout: 5000 });
        let counter: number = 0;
        while (true) {
            let status = run_info.status;
            logger.verbose(status);
            counter += 1;
            if (status === "completed") {
                break;
            } else if (status === "failed" || status === "cancelled") {
                return { response: undefined, thread_id: undefined, input_tokens: run_info.usage?.prompt_tokens, output_tokens: run_info.usage?.completion_tokens, new_context: true };
            } else if (counter === 3) {
                logger.warn(`Timeout reached, cancelling thread. Thread: ${chatThread.id} Run: ${threadRun.id}`);
                await openai.beta.threads.runs.cancel(chatThread.id, threadRun.id, { timeout: 5000 });
                return { response: undefined, thread_id: undefined, input_tokens: run_info.usage?.prompt_tokens, output_tokens: run_info.usage?.completion_tokens, new_context: true };
            }
            await sleep(1000);
            run_info = await openai.beta.threads.runs.retrieve(chatThread.id, threadRun.id, { timeout: 5000 });
        }

        const newThreadMessages = await openai.beta.threads.messages.list(
            chatThread.id,
            { timeout: 5000 }
        );
        //logger.verbose(util.inspect(newThreadMessages, { depth: null }));
        var response: string[] = [];
        newThreadMessages.data.filter(d => d.role === "assistant").forEach((e) => {
            e.content.forEach((c) => {
                if (c.type === "text") {
                    response.push(c.text.value);
                }
            });
        });

        return { response: response.join("\n\n"), thread_id: chatThread.id, input_tokens: run_info.usage?.prompt_tokens, output_tokens: run_info.usage?.completion_tokens, new_context: true };

    } catch (err: any) {
        logger.error(err);
        return { response: undefined, thread_id: undefined, input_tokens: undefined, output_tokens: undefined, new_context: true };
    }
}

export { generate_no_context, generate_with_context, initialize };