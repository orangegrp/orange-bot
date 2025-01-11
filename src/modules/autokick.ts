import { ArgType, Bot, Command, ConfigConfig, ConfigStorage, ConfigValueType, Module } from "orange-bot-base";
import { ButtonStyle, ComponentType, Guild, GuildMember, Message, SnowflakeUtil } from "discord.js";
import { sleep, getLogger } from "orange-common-lib";
import scheduler from "node-schedule";
import autokick2 from "./autokick/autokick2.js";
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
 * @param timeout The timeout in milliseconds.
 * @param joinTimeout Timeout after joining (ms)
 * @returns true if the member sent a message within the given timeout, false otherwise.
 */
async function checkIfMemberSentMessageRecently(member: GuildMember, guild: Guild, timeout: number, joinTimeout: number): Promise<{ kick: false } | { kick: true, reason: "inactive" | "joinInactive" }> {
    if (autoKickConfig) {
        // First, check the db for any known timestamps
        const memberConfig = autoKickConfig.member(guild, member);

        if (await memberConfig.get("whitelisted")) {
            logger.verbose(`Ignored whitelisted member ${member.user.tag} (${member.id})`);
            return { kick: false };
        }
        
        if (Date.now() - await memberConfig.get("lastActive") < timeout) {
            return { kick: false };
        }
    }
    if (member.joinedTimestamp && Date.now() - member.joinedTimestamp < joinTimeout) {
        logger.verbose(`Member joined recently ${member.user.tag} (${member.id})`);
        return { kick: false };
    }

    let foundMessage = false;

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
                    return { kick: false };;
                }
                foundMessage = true;
            }
            await sleep(50); // add delay to prevent discord from rate limiting
        } catch { /* ignore */ }
    }
    if (!foundMessage) {
        return { kick: true, reason: "joinInactive" };
    }
    return { kick: true, reason: "inactive" };;
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
        },
        inactiveTime: {
            type: ConfigValueType.integer,
            displayName: "Inactive time (days)",
            description: "The time a user needs to be inactive for to get an autokick notification",
            permissions: "Administrator",
            default: 14,
        },
        joinInactiveTime: {
            type: ConfigValueType.integer,
            displayName: "Join Inactive Time",
            description: "The time after joining the server that a user is considered to be inactive (if they have never sent a message)",
            default: 5,
        }
    },
    user: {
        lastActive: {
            type: ConfigValueType.number,
            displayName: "Last active",
            description: "When were you last active?",
            uiVisibility: "readonly",
            default: 0,
        },
        whitelisted: {
            type: ConfigValueType.boolean,
            displayName: "Whitelisted",
            description: "Users that are whitelisted will be ignored in future autokicks",
            uiVisibility: "readonly",
            default: false,
        },
        autokick: {
            type: ConfigValueType.boolean,
            displayName: "Autokick",
            description: "Autokick this user when they send a message",
            uiVisibility: "hidden",
            default: false,
        }
    }
} satisfies ConfigConfig;

let autoKickConfig: ConfigStorage<typeof autoKickConfigManifest> | undefined;

async function main(bot: Bot, module: Module) {
    //if (!module.handling) return;
    if (!autoKickConfig) autoKickConfig = new ConfigStorage(autoKickConfigManifest, bot);
    await autoKickConfig.waitForReady();
    await sleep(10000); // wait another 10s before running (just in case any startup issues)
    const member_list: { member: GuildMember, reason: "inactive" | "joinInactive" }[] = [];

    logger.info("Checking for members that are inactive ...");
    for (const [_, guild] of bot.client.guilds.cache) {

        const guildConfig = autoKickConfig.guild(guild);

        const inactiveTime = await guildConfig.get("inactiveTime") * 24 * 60 * 60 * 1000;
        const joinInactiveTime = await guildConfig.get("joinInactiveTime") * 24 * 60 * 60 * 1000;

        const members = await getAllPrunableMembers(guild, bot);

        for (const [_, member] of members) {
            if (!member) continue;
            if (member.user.bot) continue;
            if (member.user.id === bot.client.user?.id) continue;

            const result = await checkIfMemberSentMessageRecently(member, guild, inactiveTime, joinInactiveTime)

            if (!result.kick) {
                logger.log(`Member sent message recently ${member.user.tag} (${member.id})`);
            } else {
                logger.log(`Member did not send message recently ${member.user.tag} (${member.id})`);
                if (member_list.includes({ member: member, reason: result.reason })) continue;
                member_list.push({ member: member, reason: result.reason });
            }
        }
        await sleep(1000); // sleep to avoid rate limiting
    }
    logger.ok("The pruning has completed. Sending out notifications now ...");
    for (const { member, reason } of member_list) {
        await sleep(1000);
        await onMemberInActive(bot, member, reason);
    }
}

async function onMemberInActive(bot: Bot, member: GuildMember, reason: "inactive" | "joinInactive") {
    const notif_channel_id = await autoKickConfig?.guild(member.guild).get("autokickChannel");
    if (!notif_channel_id) { logger.error("Autokick channel not set. Cannot send notifications!"); return; }
    const notif_channel = await bot.client.channels.fetch(notif_channel_id);
    if (!notif_channel) return;

    if (notif_channel.isSendable()) {
        const lastActive = await autoKickConfig?.member(member.guild, member).get("lastActive") ?? 0;

        await notif_channel.send({
            embeds: [{
                title: `:bell: ${member.user.username} is inactive`,
                thumbnail: { url: member.user.avatarURL() || "" },
                description: reason === "inactive" ? `<@${member.user.id}> has not engaged with the community recently.`
                                                   : `<@${member.user.id}> has not engaged with the community after joining.`,
                fields: [
                    { name: "Joined", value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "Unknown" },
                    { name: "Last Active", value: lastActive === 0 ? "No data" : `<t:${Math.floor(lastActive / 1000)}:R>` }
                ]
            }],
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        { type: ComponentType.Button, label: "Kick", style: ButtonStyle.Danger, customId: `ak_k_${member.id}` },
                        { type: ComponentType.Button, label: "Ignore", style: ButtonStyle.Success, customId: `ak_p_${member.id}` },
                        { type: ComponentType.Button, label: "Whitelist", style: ButtonStyle.Primary, customId: `ak_w_${member.id}` },
                    ]
                }
            ]
        });
    }
}

const autokickCommand = {
    name: "autokick",
    description: "Manage autokick",
    options: {
        whitelist: {
            description: "Manage autokick whitelist",
            args: {
                action: {
                    description: "Whitelist action",
                    type: ArgType.STRING,
                    choices: [{
                        name: "List whitelisted users",
                        value: "list"
                    }, {
                        name: "Add user to whitelist",
                        value: "add"
                    }, {
                        name: "Remove user from whitelist",
                        value: "remove"
                    }],
                    required: true
                },
                user: {
                    description: "User to add to or remove from whitelist",
                    type: ArgType.USER,
                    required: false
                }
            }
        }
    }
} as const satisfies Command;

export default async function (bot: Bot, module: Module) {
   //if (!module.handling) return;
    autoKickConfig = new ConfigStorage(autoKickConfigManifest, bot);
    await autoKickConfig.waitForReady();

    bot.client.on("interactionCreate", async interaction => {
        //if (!module.handling) return;
        if (interaction.isButton()) {
            if (!interaction.inGuild()) {
                interaction.reply({ content: "This can't be used outside guilds", ephemeral: true });
            }
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
            } else if (interaction.customId.startsWith("ak_w_")) {
                const member = await bot.client.guilds.cache.get(interaction.guildId ?? "")?.members.fetch(interaction.customId.split("_")[2]);
                if (!member) {
                    await interaction.reply({ content: "Member not found!", ephemeral: true });
                    return;
                }
                await autoKickConfig?.member(member.guild, member.id).set("whitelisted", true);
                await interaction.update({ content: `:roll_of_paper: <@${interaction.user.id}> has whitelisted **${member?.user.username}**.\n(He won't show up in autokicks again)`, embeds: [], components: [] });
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

    module.addCommand(autokickCommand, async (interaction, args) => {
        if (!interaction.inGuild()) {
            await interaction.reply({ content: "This can't be used outside guilds", ephemeral: true });
            return;
        }
        if (args.action === "list") {
            const guild = interaction.guild ?? (await bot.getGuild(interaction.guildId))?.guild;
            if (!guild) {
                await bot.replyWithError(interaction, "Guild not found. :(");
                return;
            }
            const members = await guild.members.fetch();
            const whitelist: string[] = []; 
            for (const [id, _] of members) {
                const whitelisted = await autoKickConfig?.member(interaction.guildId, id).get("whitelisted");
                if (whitelisted) {
                    whitelist.push(id);
                }
            }
            await bot.noPingReply(interaction, { content: `Whitelisted users: \n    ${whitelist.map(id => `<@${id}>`).join("\n    ")}` });
            return;
        }
        if (args.user === undefined) {
            await bot.replyWithError(interaction, "You need to specify a user to use this action. :(");
            return;
        }

        const member = autoKickConfig?.member(interaction.guildId, args.user.id);
        if (!member) {
            await bot.replyWithError(interaction, "Sorry, an error has occurred with this action. :(");
            return;
        }
        
        if (args.action === "add") {
            await member.set("whitelisted", true);
            await interaction.reply(`Added <@${args.user.id}> to the whitelist!`);
        } 
        if (args.action === "remove") {
            await member.set("whitelisted", false);
            await interaction.reply(`Removed <@${args.user.id}> from the whitelist!`);
        }
    });

    autokick2(bot, module, autoKickConfig);
}

type AutoKickConfigManifest = typeof autoKickConfigManifest;

export type { AutoKickConfigManifest };