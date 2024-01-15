import { CacheType, ChatInputCommandInteraction, EmbedBuilder, PermissionsBitField as Perms } from "discord.js";
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

        const output = await executor.runCommand(command);

        if (output.output) {
            interaction.editReply("```" + output.output.stdout + output.output.stderr + "```");
        }
        else {
            interaction.editReply("error: " + (output.error as any).message);
        }
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