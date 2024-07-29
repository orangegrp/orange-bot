import OpenAI from "openai";
import { sleep } from "orange-bot-base";
import { getLogger } from "orange-common-lib";
import { CodeRunner } from "../../modules/code-runner/codeRunner.js";
import util from "util";
import { APIEmbed } from "discord.js";
import { Language } from "../code-runner/languages.js";

var openai: OpenAI | undefined = undefined;
var cr: CodeRunner;

async function initialize() {
    if (process.env.OPENAI_KEY) {
        openai = new OpenAI({ apiKey: process.env.OPENAI_KEY});
        cr = new CodeRunner({
            server: process.env.CODERUNNER_SERVER!,
            apiKey: process.env.CODERUNNER_API_KEY!
        });
    }
}

/// TODO: RE-WRITE THIS MODULE IN THE NEXT ITERATION (LOW PRIORITY)

const logger = getLogger("openai");
const context_history_length = 48;

async function generate_with_context(thread_id: string, user_name: string, user_id: string, user_prompt: string, assistant_id: string): Promise<{ response?: string, thread_id?: string, input_tokens?: number, output_tokens?: number, new_context?: boolean, extra?: APIEmbed[], extra_text?: string }> {
    if (!openai) {
        await initialize();
        if (!openai) {
            return { response: undefined, thread_id: undefined, input_tokens: undefined, output_tokens: undefined, new_context: true };
        }
    }

    var extra_input_t = 0;
    var extra_output_t = 0;
    var response_suffix = "";
    const extra_info: APIEmbed[] = [];

    try {
        if (user_prompt.length > 100) {
            user_prompt = user_prompt.substring(0, 100);
            user_prompt += "\n\n[User input truncated to 100 characters]";
        }
        const chatThread = await openai.beta.threads.retrieve(thread_id);
        //logger.verbose(util.inspect(chatThread, { depth: null }));
        const threadMsgs = await openai.beta.threads.messages.list(chatThread.id,  { timeout: 10000 });    
        //logger.verbose(util.inspect(threadMsgs, { depth: null }));
        if (threadMsgs.data.length > context_history_length) {
            return generate_no_context(user_name, user_id, user_prompt, assistant_id);
        }
        const contextThreadMsgs = await openai.beta.threads.messages.create(
            chatThread.id,
            { role: "user", content: `User: "${user_name}" with ID: "${user_id}" said: \`\`\`${user_prompt}\`\`\`` },
            { timeout: 10000 }
        );
        //logger.verbose(util.inspect(contextThreadMsgs, { depth: null }));
        const threadRun = await openai.beta.threads.runs.create(
            chatThread.id,
            { assistant_id: assistant_id, model: /*"gpt-3.5-turbo-0125"*/ "gpt-4o-mini" },
            { timeout: 10000 }
        );
        //logger.verbose(util.inspect(threadRun, { depth: null }));
        let run_info = await openai.beta.threads.runs.retrieve(chatThread.id, threadRun.id, { timeout: 10000 });
        let counter: number = 0;
        while (true) {
            let status = run_info.status;
            logger.verbose(status);
            if (status === "completed") {
                break;
            } else if (status === "requires_action") {
                const steps = await openai.beta.threads.runs.steps.list(chatThread.id, threadRun.id, { timeout: 10000 });
                for (const step of steps.data) {
                    if (step.status === "in_progress" && step.type === "tool_calls" && step.step_details.type === "tool_calls") {
                        const tool_call = step.step_details.tool_calls[0];
                        if (tool_call.type !== "function") {
                            continue;
                        }
                        if (tool_call.function.name === "run_code_p") {
                            const result = await generate_no_context(user_name, user_id, user_prompt, "asst_tGuyqxwYqbjVAhoIpTfjFJLU", true);

                            await openai.beta.threads.runs.submitToolOutputs(
                                chatThread.id, threadRun.id, { tool_outputs: [ {
                                    tool_call_id: tool_call.id,
                                    output: result.response
                                }] }, { timeout: 10000 }
                            );

                            extra_input_t += result.input_tokens ?? 0;
                            extra_output_t += result.output_tokens ?? 0;

                            if (result.extra_text)
                                response_suffix += result.extra_text;
                            if (result.extra)
                                extra_info.push(...result.extra);
                        }
                    }
                }
            } else if (status === "failed" || status === "cancelled") {
                return { response: undefined, thread_id: undefined, input_tokens: run_info.usage?.prompt_tokens, output_tokens: run_info.usage?.completion_tokens, new_context: false };
            } else if (counter === 10) {
                logger.warn(`Timeout reached, cancelling thread. Thread: ${chatThread.id} Run: ${threadRun.id}`);
                run_info = await openai.beta.threads.runs.retrieve(chatThread.id, threadRun.id, { timeout: 10000 });
                if (run_info.status === "in_progress")
                    await openai.beta.threads.runs.cancel(chatThread.id, threadRun.id);
                continue;
            }
            await sleep(1000);
            run_info = await openai.beta.threads.runs.retrieve(chatThread.id, threadRun.id, { timeout: 10000 });
            counter += 1;
        }

        const newThreadMessages = await openai.beta.threads.messages.list(
            chatThread.id, 
            { timeout: 10000 }
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

        return { extra_text: response_suffix, response: response.join("\n\n"), thread_id: chatThread.id, input_tokens: (run_info.usage?.prompt_tokens ?? 0) + extra_input_t, output_tokens: (run_info.usage?.completion_tokens ?? 0) + extra_output_t, new_context: false, extra: extra_info };

    } catch (err: any) {
        logger.error(err);
        return { response: undefined, thread_id: undefined, input_tokens: undefined, output_tokens: undefined, new_context: false };
    }
}

async function generate_no_context(user_name: string, user_id: string, user_prompt: string, assistant_id: string, raw_prompt: boolean = false): Promise<{ response?: string, thread_id?: string, input_tokens?: number, output_tokens?: number, new_context?: boolean, extra?: APIEmbed[], extra_text?: string }> {
    if (!openai) {
        await initialize();
        if (!openai) {
            return { response: undefined, thread_id: undefined, input_tokens: undefined, output_tokens: undefined, new_context: true };
        }
    }

    const start_time = Date.now();
    var extra_input_t = 0;
    var extra_output_t = 0;
    var response_suffix = "";
    const extra_info: APIEmbed[] = [];

    try {
        if (user_prompt.length > 100) {
            user_prompt = user_prompt.substring(0, 100);
            user_prompt += "\n\n[User input truncated to 100 characters]";
        }
        const chatThread = await openai.beta.threads.create( { timeout: 10000 });
        //logger.verbose(util.inspect(chatThread, { depth: null }));
        const threadMsgs = await openai.beta.threads.messages.create(
            chatThread.id,
            { role: "user", content: raw_prompt ? user_prompt :`User: "${user_name}" with ID: "${user_id}" said: \`\`\`${user_prompt}\`\`\`` },
            { timeout: 10000 }
        );
        //logger.verbose(util.inspect(threadMsgs, { depth: null }));
        const threadRun = await openai.beta.threads.runs.create(
            chatThread.id,
            { assistant_id: assistant_id, model: /* "gpt-3.5-turbo-0125"*/ "gpt-4o-mini" },
            { timeout: 10000 }
        );
        //logger.verbose(util.inspect(threadRun, { depth: null }));
        let run_info = await openai.beta.threads.runs.retrieve(chatThread.id, threadRun.id,  { timeout: 10000 });
        let counter: number = 0;
        while (true) {
            let status = run_info.status;
            logger.verbose(status);
            counter += 1;
            if (status === "completed") {
                break;
            } else if (status === "requires_action") {
                const steps = await openai.beta.threads.runs.steps.list(chatThread.id, threadRun.id, { timeout: 10000 });
                for (const step of steps.data) {
                    if (step.status === "in_progress" && step.type === "tool_calls" && step.step_details.type === "tool_calls") {
                        const tool_call = step.step_details.tool_calls[0];
                        if (tool_call.type !== "function") {
                            continue;
                        }
                        if (tool_call.function.name === "run_code_p") {
                            const result = await generate_no_context(user_name, user_id, user_prompt, "asst_tGuyqxwYqbjVAhoIpTfjFJLU", true);
                            
                            await openai.beta.threads.runs.submitToolOutputs(
                                chatThread.id, threadRun.id, { tool_outputs: [ {
                                    tool_call_id: tool_call.id,
                                    output: result.response
                                }] }, { timeout: 10000 }
                            );
                            
                            extra_input_t += result.input_tokens ?? 0;
                            extra_output_t += result.output_tokens ?? 0;
                            
                            if (result.extra_text)
                                response_suffix += result.extra_text;
                            if (result.extra)
                                extra_info.push(...result.extra);
                        } else if (tool_call.function.name === "run_code") {
                            const params = JSON.parse(tool_call.function.arguments) as { code: string, language: Language, stdin?: string, argv?: string[] };
                            const result = await cr.runCodeV1(params.code, params.language, params.stdin, params.argv);
                            const run_time = ((Date.now() - start_time) / 1000).toFixed(1);

                            await openai.beta.threads.runs.submitToolOutputs(
                                chatThread.id, threadRun.id, { tool_outputs: [ {
                                    tool_call_id: tool_call.id,
                                    output: JSON.stringify({
                                        exitCode: result.exitCode,
                                        compilerOutput: result.exitCode !== 0 ? result.compilerOutput.substring(0, 100) : "Success",
                                        processOutput: result.processOutput.substring(0, 100)
                                    })
                                }]}, { timeout: 10000 }
                            );
                            
                            logger.verbose(util.inspect(params, { depth: null }));

                            response_suffix += `\`\`\`${params.code.replace(/`/g, '\u1fef')}\`\`\``;

                            extra_info.push({
                                title: `Executed \`${params.language}\` code (${run_time}s).`,
                                author: { name: `Run ID: ${result.jobId}` },
                                description: (result.processOutput.length > 0 ? `\`\`\`\n${result.processOutput}\`\`\`` : 'No output received.') + `\nExit code: ${result.exitCode}`,
                                footer: { text: `Ora Assistant • Powered by orange Code Runner Server API v1` },
                                timestamp: new Date().toISOString(),
                            });               
                        }
                    }
                }
            } else if (status === "failed" || status === "cancelled") {
                return { extra_text: response_suffix, response: undefined, thread_id: undefined, input_tokens: (run_info.usage?.prompt_tokens ?? 0) + extra_input_t, output_tokens: (run_info.usage?.completion_tokens ?? 0) + extra_output_t, new_context: true };
            } else if (counter === 10) {
                logger.warn(`Timeout reached, cancelling thread. Thread: ${chatThread.id} Run: ${threadRun.id}`);
                await openai.beta.threads.runs.cancel(chatThread.id, threadRun.id, { timeout: 10000 });
                return { extra_text: response_suffix, response: undefined, thread_id: undefined, input_tokens: (run_info.usage?.prompt_tokens ?? 0) + extra_input_t, output_tokens: (run_info.usage?.completion_tokens ?? 0) + extra_output_t, new_context: true };
            }
            await sleep(1000);
            run_info = await openai.beta.threads.runs.retrieve(chatThread.id, threadRun.id, { timeout: 10000 });
        }

        const newThreadMessages = await openai.beta.threads.messages.list(
            chatThread.id,
            { timeout: 10000 }
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

        return { extra_text: response_suffix, response: response.join("\n\n"), thread_id: chatThread.id, input_tokens: (run_info.usage?.prompt_tokens ?? 0) + extra_input_t, output_tokens: (run_info.usage?.completion_tokens ?? 0) + extra_output_t, new_context: true, extra: extra_info };

    } catch (err: any) {
        logger.error(err);
        return { extra_text: response_suffix, response: undefined, thread_id: undefined, input_tokens: undefined, output_tokens: undefined, new_context: true };
    }
}

export { generate_no_context, generate_with_context, initialize };