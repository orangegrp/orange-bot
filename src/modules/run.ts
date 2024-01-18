import { AttachmentBuilder, EmbedBuilder, PermissionsBitField as Perms } from "discord.js";
import type { CacheType, ChatInputCommandInteraction, InteractionEditReplyOptions } from "discord.js";
import { getLogger } from "orange-common-lib";
import type { Bot } from "orange-bot-base";
import { CommandExecutor } from "./linux-run/commandExecutor.js";
import { ArgType, type Command } from "orange-bot-base/dist/command.js";
import { CodeRunner } from "./codeRunner/codeRunner.js";

const logger = getLogger("linux");


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
    description: "runs a code or a linux command",
    options: {
        linux: {
            description: "runs a linux command",
            args: {
                command: {
                    type: ArgType.STRING,
                    description: "command to run",
                    required: true
                }
            }
        },
        code: {
            description: "runs code",
            args: {
                code: {
                    type: ArgType.STRING,
                    description: "code to run",
                    required: true
                },
                language: {
                    type: ArgType.STRING,
                    description: "language of the code",
                    required: true
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
        if (args.subCommand == "linux") {
            await handleLinuxRun(interaction, args.command);
        }
        else {
            await handleCodeRun(interaction, args.code, args.language);
        }
    });

    async function handleLinuxRun(interaction: ChatInputCommandInteraction<CacheType>, command: string) {
        await interaction.deferReply();

        let lastMessage = "";
        let outputBuffer = "";
        let lastEdit = Date.now();
        let paused = false;

        const output = await executor.runCommand(command, onOutput);

        function onOutput(output: string) {
            outputBuffer += output;
            if (Date.now() - lastEdit < 1000 || paused) return;
            
            if (outputBuffer.length > 1000) {
                interaction.editReply(formatOutput(lastMessage + "\nThe rest of the output will be sent as an attachment."));
                paused = true;
                return;
            }
            interaction.editReply(formatOutput(outputBuffer));
            lastMessage = outputBuffer;
        }
        function formatOutput(output: string, finished: boolean = false, exitCode?: number | string, useFile?: boolean): InteractionEditReplyOptions {
            return { 
                embeds: [{
                    title: `${finished ? "ran" : "running"} command \`${command}\``,
                    description: "```" + (useFile ? "Command output in attachment." : output) + "```" + (finished ? `\nexit code: ${exitCode}` : ""),
                    timestamp: new Date().toISOString()
                }],
                files: useFile ? [
                    new AttachmentBuilder(Buffer.from(outputBuffer), { name: "output.txt" })
                ] : undefined
            };
        }

        if (outputBuffer.length > 1000) {
            interaction.editReply(formatOutput(outputBuffer, true, output.output?.code || "unknown", true));
            return;
        }

        interaction.editReply(formatOutput(outputBuffer, true, output.output?.code || "unknown", false));
    }
    async function handleCodeRun(interaction: ChatInputCommandInteraction<CacheType>, code: string, language: string) {
        if (!codeRunner.checkLang(language)) {
            await interaction.reply(`not a recognized language: "${language}"`);
            return;
        }

        await interaction.deferReply();
        
        const result = await codeRunner.runCode(code, language);

        const embed = new EmbedBuilder({
            title: `:computer: Job completed.`,
            description: result.processOutput.length > 0 ? `\`\`\`${result.processOutput}\`\`\`` : 'No output received.',
            author: { name: `Job ID: ${result.jobId}` },
            footer: { text: `Job owner: ${interaction.user.username}` },
            timestamp: Date.now(),
        });

        await interaction.editReply({ embeds: [embed] });
    }
}