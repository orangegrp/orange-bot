import { PermissionsBitField as Perms } from "discord.js";
import { getLogger } from "orange-common-lib";
import type { Bot } from "orange-bot-base";
import { CommandExecutor } from "./linux-run/commandExecutor.js";
import { ArgType, type Command } from "orange-bot-base/dist/command.js";

const logger = getLogger("linux")


const SSH_HOST = process.env.SSH_HOST || ""
const SSH_PORT = Number.parseInt(process.env.SSH_PORT || "22")
const SSH_USER = process.env.SSH_USER || ""
const SSH_PASSWORD = process.env.SSH_PASSWORD || ""
const SSH_ROOT_USER = process.env.SSH_ROOT_USER || ""
const SSH_ROOT_PASSWORD = process.env.SSH_ROOT_PASSWORD || ""


const runCommand = {
    name: "run",
    description: "runs a linux command",
    args: {
        command: {
            type: ArgType.STRING,
            description: "command to run",
            required: true
        }
    }
} satisfies Command


export default async function(bot: Bot) {
    if (!SSH_HOST) return logger.warn("SSH_HOST not set!");
    if (!SSH_USER) return logger.warn("SSH_USER not set!");
    if (!SSH_PASSWORD) return logger.warn("SSH_PASSWORD not set!");
    if (!SSH_ROOT_USER) return logger.warn("SSH_ROOT_USER not set!");
    if (!SSH_ROOT_PASSWORD) return logger.warn("SSH_ROOT_PASSWORD not set!");

    const executor = new CommandExecutor({
        host: SSH_HOST,
        port: SSH_PORT,
        username: SSH_USER,
        password: SSH_PASSWORD,
        rootUsername: SSH_ROOT_USER,
        rootPassword: SSH_ROOT_PASSWORD,
    }, logger);

    bot.addChatCommand("runreboot", async (msg, args) => {
        await executor.reboot();
        msg.channel.send("rebooting.")
    }, { permissionRequired: Perms.Flags.Administrator })

    bot.addChatCommand("runcleanup", async (msg, args) => {
        await executor.cleanUp();
        msg.channel.send("cleanup done.")
    })

    bot.addCommand(runCommand, async (interaction, args) => {
        interaction.deferReply();
        const output = await executor.runCommand(args.command);
        console.log(output)
        if (output.output) {
            interaction.editReply("```" + output.output.stdout + output.output.stderr + "```");
        }
        else {
            interaction.editReply("error: " + (output.error as any).message)
        }
    })
}

export { CommandExecutor }