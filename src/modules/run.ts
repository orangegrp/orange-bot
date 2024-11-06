import { AttachmentBuilder, EmbedBuilder, PermissionsBitField as Perms } from "discord.js";
import type { CacheType, ChatInputCommandInteraction, InteractionEditReplyOptions } from "discord.js";
import { getLogger } from "orange-common-lib";
import type { Bot, Command, Module } from "orange-bot-base";
import { CommandExecutor } from "./linux-run/commandExecutor.js";
import { ArgType } from "orange-bot-base";
import { CodeRunner } from "./code-runner/codeRunner.js";
import { getClosestEnvString, getRunEnvInfo, languages } from "./code-runner/languages.js";

const logger = getLogger("/run");


const SSH_HOST = process.env.SSH_HOST || "";
const SSH_PORT = Number.parseInt(process.env.SSH_PORT || "22");
const SSH_USER = process.env.SSH_USER || "";
const SSH_PASSWORD = process.env.SSH_PASSWORD || "";
const SSH_ROOT_USER = process.env.SSH_ROOT_USER || "";
const SSH_ROOT_PASSWORD = process.env.SSH_ROOT_PASSWORD || "";

const CODERUNNER_SERVER = process.env.CODERUNNER_SERVER;
const CODERUNNER_API_KEY = process.env.CODERUNNER_API_KEY;

const runCommand = {
    name: "run",
    description: "Execute code or a Linux command",
    notes: "This command uses additional services we control. Depending on the command, some encrypted data may transit through [Telia AB](https://www.teliacompany.com/en/articles/privacy) (:flag_fi:), or [DigitalOcean](https://www.digitalocean.com/legal/privacy-policy) (:flag_gb:).",
    options: {
        linux: {
            description: "Run a Linux command",
            args: {
                command: {
                    type: ArgType.STRING,
                    description: "Command to run",
                    required: true
                }
            }
        },
        code: {
            description: "Execute code",
            args: {
                /*
                language: {
                    type: ArgType.STRING,
                    description: "Programming language",
                    required: true
                },    
                */
                runtime: {
                    type: ArgType.STRING,
                    description: "Runtime environment (runtime, programming language, version)",
                    required: true,
                    autocomplete: true
                },
                snippet: {
                    type: ArgType.STRING,
                    description: "Code snippet to execute",
                    required: false
                },
                file: {
                    type: ArgType.ATTACHMENT,
                    description: "Source file to execute",
                    required: false
                },
                method: {
                    type: ArgType.STRING,
                    description: "Source method (Default: Auto-Detect)",
                    required: false,
                    choices: [
                        { name: "Snippet", value: "snippet" },
                        { name: "File", value: "file" },
                        { name: "File + Snippet", value: "file+snippet" },
                        { name: "Snippet + File (Default)", value: "snippet+file" }
                    ]
                },
                stdin: {
                    type: ArgType.STRING,
                    description: "Input to stdin",
                    required: false
                },
                argv: {
                    type: ArgType.STRING,
                    description: "Arguments",
                    required: false
                },
            }
        }
    }

} satisfies Command;


export default async function (bot: Bot, module: Module) {
    if (!SSH_HOST) return logger.warn("SSH_HOST not set!");
    if (!SSH_USER) return logger.warn("SSH_USER not set!");
    if (!SSH_PASSWORD) return logger.warn("SSH_PASSWORD not set!");
    if (!SSH_ROOT_USER) return logger.warn("SSH_ROOT_USER not set!");
    if (!SSH_ROOT_PASSWORD) return logger.warn("SSH_ROOT_PASSWORD not set!");

    if (!CODERUNNER_SERVER) return logger.warn("CODERUNNER_SERVER not set!");
    if (!CODERUNNER_API_KEY) return logger.warn("CODERUNNER_API_KEY not set!");

    const executor = new CommandExecutor({
        host: SSH_HOST,
        port: SSH_PORT,
        username: SSH_USER,
        password: SSH_PASSWORD,
        rootUsername: SSH_ROOT_USER,
        rootPassword: SSH_ROOT_PASSWORD,
    }, logger);

    const codeRunner = new CodeRunner({
        server: CODERUNNER_SERVER,
        apiKey: CODERUNNER_API_KEY,
    }, logger);


    bot.addChatCommand("runreboot", async (msg, args) => {
        await executor.reboot();
        msg.channel.send("rebooting.");
    }, { permissionRequired: Perms.Flags.Administrator });

    bot.addChatCommand("runcleanup", async (msg, args) => {
        await executor.cleanUp();
        msg.channel.send("cleanup done.");
    });

    module.addCommand(runCommand, async (interaction, args) => {
        if (args.subCommand == "linux") {
            await handleLinuxRun(interaction, args.command);
        }
        else {
            let source_code = "";
            let file_content = "";

            if (args.file) {
                const url = args.file.attachment?.url;
                if (!url) {
                    await bot.replyWithError(interaction, "Attachment not found.", logger);
                    return;
                }

                try {
                    const res = await fetch(url);
                    if (!res.ok) {
                        await bot.replyWithError(interaction, `Error fetching attachment (${res.status}).`, logger);
                        return;
                    }

                    file_content = await res.text();
                }
                catch (e: any) {
                    await bot.replyWithError(interaction, `Error fetching attachment.`, logger);
                    logger.error("args:");
                    logger.object(args);
                    logger.error("error:");
                    logger.error(e);
                    return;
                }
            }

            switch (args.method) {
                case "file+snippet":
                    if (file_content)
                        source_code += file_content;
                    source_code += "\n";
                    if (args.snippet)
                        source_code += args.snippet;
                    break;
                case "snippet+file":
                    if (args.snippet)
                        source_code += args.snippet;
                    source_code += "\n";
                    if (file_content)
                        source_code += file_content;
                    break;
                case "file":
                    if (file_content)
                        source_code += file_content;
                    break;
                case "snippet":
                    if (args.snippet)
                        source_code += args.snippet;
                    break;
                default:
                    if (args.snippet && file_content) {
                        source_code += args.snippet;
                        source_code += "\n";
                        source_code += file_content;
                    } else if (args.snippet) {
                        source_code += args.snippet;
                    } else if (file_content) {
                        source_code += file_content;
                    }
                    break;
            }

            await handleCodeRun(interaction, source_code, args.runtime, args.stdin ?? "", args.argv ?? "");
        }
    });
    module.addAutocomplete(runCommand, "runtime", async interaction => {
        const option = interaction.options.getFocused(true);
        logger.verbose(`Autocomplete for /${interaction.commandName} ${option.name}: ${option.value}`);

        let choices = await getClosestEnvString(option.value);

        return choices.map(choice => ({
                name: choice,
                value: choice
        }))
    })

    async function handleLinuxRun(interaction: ChatInputCommandInteraction<CacheType>, command: string) {
        await interaction.deferReply();

        let lastMessage = "";
        let outputBuffer = "";
        let lastEdit = Date.now();
        let paused = false;

        const start_time = Date.now();

        const output = await executor.runCommand(command, onOutput);

        function onOutput(output: string) {
            outputBuffer += output;
            if (Date.now() - lastEdit < 1000 || paused) return;

            if (outputBuffer.length > 1500) {
                interaction.editReply(formatOutput(lastMessage + "\nCommand output is too long. The rest of the output will be sent as an attachment."));
                paused = true;
                return;
            }
            interaction.editReply(formatOutput(outputBuffer));
            lastMessage = outputBuffer;
        }
        function formatOutput(output: string, finished: boolean = false, exitCode?: number | string, useFile?: boolean): InteractionEditReplyOptions {
            const run_time = ((Date.now() - start_time) / 1000).toFixed(1);

            return {
                embeds: [{
                    title: `${finished ? "Finished running" : "Running"} command \`${command}\` (${run_time}s).`,
                    description: (useFile ? "Command output in attachment." : output.length > 0 ? `\`\`\`ansi\n${output}\`\`\`` : "Command output is empty.") + (finished ? `\nExit code: ${exitCode}` : ""),
                    footer: { text: `Powered by Topias Linux-Run` },
                    timestamp: new Date().toISOString()
                }],
                files: useFile ? [
                    new AttachmentBuilder(Buffer.from(outputBuffer), { name: "output.txt" })
                ] : undefined
            };
        }

        let exitCode = "Unknown";

        if (output.output !== undefined) {
            if (Number(output.output.code) !== Number.NaN) {
                exitCode = `${output.output.code}`;
            }
        }

        if (outputBuffer.length > 1500) {
            interaction.editReply(formatOutput(outputBuffer, true, exitCode, true));
            return;
        }

        interaction.editReply(formatOutput(outputBuffer, true, exitCode, false));
    }

    async function handleCodeRun(interaction: ChatInputCommandInteraction<CacheType>, code: string, runtime: string, stdin: string, argv: string) {
        const runtime_info = await getRunEnvInfo(runtime);

        if ("error" in runtime_info) {
            await bot.replyWithError(interaction, runtime_info.error, logger);
            return;
        }

        await interaction.deferReply();

        const start_time = Date.now();

        const result = await codeRunner.runCodeV2(code, runtime_info, stdin, argv.split(" "));

        const run_time = ((Date.now() - start_time) / 1000).toFixed(1);

        const embed = new EmbedBuilder({
            title: `Executed \`${runtime_info.language}\` code (${run_time}s).`,
            author: { name: `Run ID: ${result.jobId}` },
            description: (result.processOutput.length > 0 ? `\`\`\`ansi\n${result.processOutput}\`\`\`` : 'No output received.') + `\nExit code: ${result.exitCode}`,
            footer: { text: `Runtime: ${runtime} • Powered by Piston (emkc.org)` },
            timestamp: new Date().toISOString(),
        });

        await interaction.editReply({ embeds: [embed] });
    }
}