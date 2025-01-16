import { GuildResolvable, MessageCreateOptions, MessagePayload } from "discord.js";
import { Bot, ConfigConfig, ConfigStorage, ConfigValueType, Module } from "orange-bot-base";
import { getLogger } from "orange-common-lib";
import { resolveGuild } from "orange-bot-base/dist/helpers/resolvers.js";


const logger = getLogger("audit-logs");


let _bot: Bot | undefined;


const configSchema = {
    name: "autorole",
    displayName: "Autorole",
    guild: {
        auditChannel: {
            displayName: "Audit log channel",
            description: "Channel bot audit logs will be sent to",
            type: ConfigValueType.channel,
            permissions: "ManageGuild",
        }
    }
} satisfies ConfigConfig;

let _config: ConfigStorage<typeof configSchema> | undefined;


export default async function (bot: Bot, module: Module) {
    _bot = bot;
    const config = new ConfigStorage(configSchema, bot);
    await config.waitForReady();

    module.addChatInteraction(async msg => {
        if (!msg.inGuild()) return;

        if (msg.content === `${bot.prefix}setup-audit-logs`) {
            await config.guild(msg.guild).set("auditChannel", msg.channelId);
        }
    });

}

async function auditLog(guild: GuildResolvable, message: string): Promise<void>;
async function auditLog(guild: GuildResolvable, message: MessagePayload | MessageCreateOptions): Promise<void>;
async function auditLog(guild: GuildResolvable, title: string, description: string): Promise<void>;
async function auditLog(guild: GuildResolvable, message1: string | MessagePayload | MessageCreateOptions, message2: string | null = null) {
    if (!_bot) throw new Error("Bot instance missing while trying to send audit logs.");
    if (!_config) throw new Error("Couldn't find config while trying to send audit logs.");

    const guildConfig = _config.guild(guild);

    const auditChannel = await guildConfig.get("auditChannel");

    if (!auditChannel) return;

    const channel = await (await _bot.getGuild(resolveGuild(guild)))?.getChannel(auditChannel);

    if (!channel) {
        logger.warn("Couldn't find audit logs channel!");
        return;
    }

    if (!channel.channel.isSendable()) {
        logger.warn("Audit logs channel isn't sendable!");
        return;
    }

    if (typeof message1 !== "string") {
        channel.channel.send(message1);
        return;
    }
    if (message2 === null) {
        channel.channel.send({
            embeds: [{
                timestamp: new Date().toISOString(),
                description: message1
            }]
        });
        return;
    }
    channel.channel.send({
        embeds: [{
            timestamp: new Date().toISOString(),
            title: message1,
            description: message2,
        }]
    });
}


export { auditLog }