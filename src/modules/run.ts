import { AttachmentBuilder, EmbedBuilder, PermissionsBitField as Perms } from "discord.js";
import type { CacheType, ChatInputCommandInteraction, InteractionEditReplyOptions } from "discord.js";
import { getLogger } from "orange-common-lib";
import type { Bot, Command } from "orange-bot-base";
import { CommandExecutor } from "./linux-run/commandExecutor.js";
import { ArgType } from "orange-bot-base";
import { CodeRunner } from "./codeRunner/codeRunner.js";
import { languages } from "./codeRunner/languages.js";

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
            options: {
                file: {
                    description: "Execute code from an attachment",
                    args: {
                        file: {
                            type: ArgType.ATTACHMENT,
                            description: "Code to execute",
                            required: true
                        },
                        language: {
                            type: ArgType.STRING,
                            description: "Programming language",
                            required: true
                        }
                    }
                },
                string: {
                    description: "Execute code from a string",
                    args: {
                        code: {
                            type: ArgType.STRING,
                            description: "Code to execute",
                            required: true
                        },
                        language: {
                            type: ArgType.STRING,
                            description: "Programming language",
                            required: true
                        }
                    }
                }
            }
        }
    }
    
} satisfies Command


export default async function(bot: Bot) {
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

    bot.addCommand(runCommand, async (interaction, args) => {
        console.log(args);
        if (args.subCommand == "linux") {
            await handleLinuxRun(interaction, args.command);
        }
        else {
            if (args.subCommand == "file") {
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
                    var code = await res.text();
                }
                catch (e: any) {
                    await bot.replyWithError(interaction, `Error fetching attachment.`, logger);
                    logger.error("args:");
                    logger.object(args);
                    logger.error("error:");
                    logger.error(e);
                    return;
                }

                await handleCodeRun(interaction, code, args.language);
            }
            else {
                await handleCodeRun(interaction, args.code, args.language);
            }
        }
    });

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
            
            if (outputBuffer.length > 1000) {
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
                    description: "```" + (useFile ? "Command output in attachment." : output) + "```" + (finished ? `\nExit code: ${exitCode}` : ""),
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

        if (outputBuffer.length > 1000) {
            interaction.editReply(formatOutput(outputBuffer, true, exitCode, true));
            return;
        }

        interaction.editReply(formatOutput(outputBuffer, true, exitCode, false));
    }
    async function handleCodeRun(interaction: ChatInputCommandInteraction<CacheType>, code: string, language: string) {
        if (!codeRunner.checkLang(language)) {
            await interaction.reply(`The language you specified, "${language}", is not supported. Supported languages: ${languages.map(l => `\`${l}\``).join(", ")}`);
            return;
        }

        await interaction.deferReply();

        const start_time = Date.now();
        
        const result = await codeRunner.runCode(code, language);

        const run_time = ((Date.now() - start_time) / 1000).toFixed(1);

        const embed = new EmbedBuilder({
            title: `Executed \`${language}\` code (${run_time}s).`,
            author: { name: `Run ID: ${result.jobId}` },
            description: (result.processOutput.length > 0 ? `\`\`\`${result.processOutput}\`\`\`` : 'No output received.') + `\nExit code: ${result.exitCode}`,
            footer: { text: `Powered by orange Code Runner Server API v1` },
            timestamp: new Date().toISOString(),
        });

        await interaction.editReply({ embeds: [embed] });
    }
}