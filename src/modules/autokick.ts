import { Bot, ConfigConfig, ConfigStorage, ConfigValueType, Module } from "orange-bot-base";
import { ButtonStyle, ComponentType, Guild, GuildMember, Message, SnowflakeUtil } from "discord.js";
import { sleep, getLogger } from "orange-common-lib";
import scheduler from "node-schedule";
const logger = getLogger("autokick");

/**
 * Returns all members in the guild that are "prunable", i.e. do not have any roles.
 * @param guild The guild to check.
 * @param bot The bot object.
 * @returns An array of GuildMember objects.
 */
async function getAllPrunableMembers(guild: Guild, bot: Bot) {
    const members = await guild.members.fetch();
    return members.filter(m => m === m); // true
}

/**
 * Checks if a member sent a message in the guild within the given timeout. 
 * @param member The member to check.
 * @param guild The guild to check.
 * @param bot The bot object.
 * @param timeout The timeout in milliseconds. Defaults to 2 weeks.
 * @returns true if the member sent a message within the given timeout, false otherwise.
 */
async function checkIfMemberSentMessageRecently(member: GuildMember, guild: Guild, timeout: number = 2 * 7 * 24 * 60 * 60 * 1000,) {
    if (autoKickConfig) {
        // First, check the db for any known timestamps
        const lastActive = await autoKickConfig.member(guild, member).get("lastActive");
        if (Date.now() - lastActive < timeout) {
            return true;
        }
    }
    if (member.joinedTimestamp && Date.now() - member.joinedTimestamp < timeout) {
        logger.verbose(`Member joined recently ${member.user.tag} (${member.id})`);
        return true;
    }

    const channels = await guild.channels.fetch();
    for (const [_, channel] of channels) {
        if (!channel) continue;
        if (!channel.isTextBased()) continue;
        try {
            const startTime = SnowflakeUtil.generate({ timestamp: Date.now() - timeout }).toString();
            const messages = await channel.messages.fetch({ after: startTime });
            for (const [_, message] of messages.filter(m => m.author?.id === member.id)) {
                setLastActive(message); // store this in the db so we don't need to find it again!

                if (Date.now() - message.createdTimestamp < timeout) {
                    return true;
                }
            }
            await sleep(50); // add delay to prevent discord from rate limiting
        } catch { /* ignore */ }
    }
    return false;
}

async function setLastActive(message: Message) {
    if (!message.inGuild()) return;
    if (!autoKickConfig) return;

    const member = autoKickConfig.member(message.guild, message.author);
    const lastActive = await member.get("lastActive");

    if (message.createdTimestamp > lastActive)
        await member.set("lastActive", message.createdTimestamp);
}

const autoKickConfigManifest = {
    name: "autokick",
    displayName: "Autokick Notifier",
    guild: {
        autokickChannel: {
            type: ConfigValueType.channel,
            displayName: "Autokick Channel",
            description: "Channel to send autokick notifications in",
            permissions: "ManageChannels"
        }
    },
    user: {
        lastActive: {
            type: ConfigValueType.number,
            displayName: "Last active",
            description: "When were you last active?",
            uiVisibility: "readonly",
            default: 0,
        }
    }
} satisfies ConfigConfig;

let autoKickConfig: ConfigStorage<typeof autoKickConfigManifest> | undefined;

async function main(bot: Bot, module: Module) {
    //if (!module.handling) return;
    if (!autoKickConfig) autoKickConfig = new ConfigStorage(autoKickConfigManifest, bot);
    await autoKickConfig.waitForReady();
    await sleep(10000); // wait another 10s before running (just in case any startup issues)
    const member_list: { member: GuildMember }[] = [];

    logger.info("Checking for members that are inactive ...");
    for (const [_, guild] of bot.client.guilds.cache) {
        const members = await getAllPrunableMembers(guild, bot);

        for (const [_, member] of members) {
            if (!member) continue;
            if (member.user.bot) continue;
            if (member.user.id === bot.client.user?.id) continue;
            if (await checkIfMemberSentMessageRecently(member, guild)) {
                logger.log(`Member sent message recently ${member.user.tag} (${member.id})`);
            } else {
                logger.log(`Member did not send message recently ${member.user.tag} (${member.id})`);
                if (member_list.includes({ member: member })) continue;
                member_list.push({ member: member });
            }
        }
        await sleep(1000); // sleep to avoid rate limiting
    }
    logger.ok("The pruning has completed. Sending out notifications now ...");
    for (const { member } of member_list) {
        await sleep(1000);
        await onMemberInActive(bot, member);
    }
}

async function onMemberInActive(bot: Bot, member: GuildMember) {
    const notif_channel_id = await autoKickConfig?.guild(member.guild).get("autokickChannel");
    if (!notif_channel_id) { logger.error("Autokick channel not set. Cannot send notifications!"); return; }
    const notif_channel = await bot.client.channels.fetch(notif_channel_id);
    if (!notif_channel) return;

    if (notif_channel.isTextBased()) {
        const lastActive = await autoKickConfig?.member(member.guild, member).get("lastActive") ?? 0;

        await notif_channel.send({
            embeds: [{
                title: `:bell: ${member.user.username} is inactive`,
                thumbnail: { url: member.user.avatarURL() || "" },
                description: `<@${member.user.id}> has not engaged with the community recently.`,
                fields: [
                    { name: "Joined", value: member.joinedAt?.toUTCString() ?? "Unknown" },
                    { name: "Last Active", value: lastActive === 0 ? "No data" : `<t:${Math.floor(lastActive / 1000)}:R>` }
                ]
            }],
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        { type: ComponentType.Button, label: "Kick", style: ButtonStyle.Danger, customId: `ak_k_${member.id}` },
                        { type: ComponentType.Button, label: "Pardon", style: ButtonStyle.Success, customId: `ak_p_${member.id}` }
                    ]
                }
            ]
        });
    }
}

export default async function (bot: Bot, module: Module) {
   //if (!module.handling) return;
    autoKickConfig = new ConfigStorage(autoKickConfigManifest, bot);
    await autoKickConfig.waitForReady();

    bot.client.on("interactionCreate", async interaction => {
        //if (!module.handling) return;
        if (interaction.isButton()) {
            if (interaction.customId.startsWith("ak_k_")) {
                if (!interaction.memberPermissions?.has("KickMembers")) {
                    await interaction.reply({ content: "You do not have permission to kick members.", ephemeral: true });
                    return;
                }
                const member = await bot.client.guilds.cache.get(interaction.guildId ?? "")?.members.fetch(interaction.customId.split("_")[2]);
                if (!member) return;
                await member.kick("Inactive");
                await interaction.update({ content: `:ballot_box_with_check: **${member.user.username}** has been kicked for inactivity by <@${interaction.user.id}>.`, embeds: [], components: [] });
            } else if (interaction.customId.startsWith("ak_p_")) {
                const member = await bot.client.guilds.cache.get(interaction.guildId ?? "")?.members.fetch(interaction.customId.split("_")[2]);
                await interaction.update({ content: `:scales: <@${interaction.user.id}> has pardoned **${member?.user.username}**.`, embeds: [], components: [] });
            }
        }
    });
    bot.client.on("messageCreate", async message => {
        setLastActive(message);
    });

    main(bot, module);
    logger.log("Registering scheduler job ...");
    scheduler.scheduleJob("0 0 * * *", () => main(bot, module));
    logger.ok("Scheduler job registered.");
}