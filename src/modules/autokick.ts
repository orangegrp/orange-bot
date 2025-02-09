import { ArgType, Bot, Command, ConfigConfig, ConfigStorage, ConfigValueType, Module } from "orange-bot-base";
import { ButtonStyle, ComponentType, Guild, GuildMember, GuildTextBasedChannel, Message, MessageType, SnowflakeUtil } from "discord.js";
import { sleep, getLogger } from "orange-common-lib";
import scheduler from "node-schedule";
import autokick2 from "./autokick/autokick2.js";
import { auditLog } from "./auditlogs.js";
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
            permissions: "Administrator",
            default: 5,
        },
        daysToCheck: {
            type: ConfigValueType.integer,
            displayName: "Days to check",
            description: "How many days of messages to check when calculating inactivity",
            permissions: "Administrator",
            uiVisibility: "hidden",
            default: 3,
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


type ActivityData = {
    lastActive: number;
    member: GuildMember;
}

/**
 * @param bot reference to bot instance
 * @param guild guild to check thru
 * @param days how many days to check
 * @returns activity data
 */
async function checkActivityInGuild(bot: Bot, guild: Guild, days: number) {
    if (!autoKickConfig) throw new Error("Storage missing!");

    const members = await getAllPrunableMembers(guild, bot);
    const activityData = new Map<string, ActivityData>();

    // Fetch stored activity data for all members
    for (const member of members.values()) {
        const lastActive = await autoKickConfig.member(guild, member).get("lastActive");
        activityData.set(member.id, { member, lastActive });
    }

    // Scan thru all channels
    for (const channel of (await guild.channels.fetch()).values()) {
        if (!channel) continue;
        if (!channel.isTextBased()) continue;

        await scanMessagesInChannel(channel, activityData, 2 * 24 * 60 * 60 * 1000);
    }

    // Store updated data in database
    for (const member of members.values()) {
        const memberData = activityData.get(member.id);
        if (!memberData) continue;

        autoKickConfig.member(guild, member).set("lastActive", memberData.lastActive);
    }

    return activityData;
}

async function scanMessagesInChannel(channel: GuildTextBasedChannel, activityData: Map<string, ActivityData>, days: number) {
    const endTime = Date.now() - days * 24 * 60 * 60 * 1000;

    let timestamp = Date.now();

    let snowflake = SnowflakeUtil.generate({ timestamp: Date.now() }).toString();

    while (timestamp > endTime) {
        // wait just a bit so discord doesn't ratelimit this
        await sleep(50);
        const messages = await channel.messages.fetch({ before: snowflake });

        let lastMessage: Message<boolean> | undefined;

        for (const message of messages.values()) {
            lastMessage = message;

            // skip join messages!
            if (message.type === MessageType.UserJoin) continue;
            
            let memberData = activityData.get(message.author.id);

            // somehow found member that wasn't listed? add them
            if (!memberData) {
                if (!message.member) continue;
                memberData = { member: message.member, lastActive: message.createdTimestamp };
                activityData.set(message.author.id, memberData);
                continue
            }

            // if a newer message is found, update activity data
            if (memberData.lastActive < message.createdTimestamp) {
                memberData.lastActive = message.createdTimestamp;
            }
        }

        // this will happen if there's no messages
        if (!lastMessage) break;

        snowflake = lastMessage.id;
        timestamp = lastMessage.createdTimestamp;
    }
}


async function runAutokick(bot: Bot) {
    if (!autoKickConfig) throw new Error("Autokick storage missing!");

    logger.info("Checking for members that are inactive ...");

    for (const oAuthGuild of (await bot.client.guilds.fetch()).values()) {
        const guildConfig = await autoKickConfig.guild(oAuthGuild.id).getAll();

        if (guildConfig.autokickChannel === null) {
            logger.info(`Skipping guild ${oAuthGuild.name}, autokick channel not set.`);
            continue;
        }

        const guild = await oAuthGuild.fetch();

        const autokickChannel = await guild.channels.fetch(guildConfig.autokickChannel);

        if (autokickChannel === null) {
            logger.info(`Skipping guild ${oAuthGuild.name}, autokick channel not found.`);
            continue;
        }
        if (!autokickChannel.isSendable()) {
            logger.info(`Skipping guild ${oAuthGuild.name}, autokick channel not sendable.`);
            continue;
        }

        logger.info(`Checking guild ${oAuthGuild.name}`);
    
        const activityData = await checkActivityInGuild(bot, guild, guildConfig.daysToCheck);

        const inactiveTime = Date.now() - guildConfig.inactiveTime * 24 * 60 * 60 * 1000;
        const joinInactiveTime = Date.now() - guildConfig.joinInactiveTime * 24 * 60 * 60 * 1000;

        for (const memberData of activityData.values()) {
            const member = memberData.member;

            if (member.user.bot) {
                logger.log(`Member is a bot, skipping ${member.user.tag} (${member.id})`);
                continue;
            }

            if (await autoKickConfig.member(guild, member).get("whitelisted")) {
                logger.log(`Member is a bot, skipping ${member.user.tag} (${member.id})`);
                continue;
            }

            if (memberData.lastActive > inactiveTime) {
                logger.log(`Member sent message recently ${member.user.tag} (${member.id})`);
                continue;
            }

            if (member.joinedTimestamp) {
                if (member.joinedTimestamp > joinInactiveTime) {
                    logger.log(`Member joined recently ${member.user.tag} (${member.id})`);
                    continue;
                }
                else if (memberData.lastActive < member.joinedTimestamp) {
                    logger.log(`Member inactive (after joining) ${member.user.tag} (${member.id})`);
                    onMemberInActive(autokickChannel, memberData, "joinInactive");
                    continue;
                }
            }
            logger.log(`Member inactive ${member.user.tag} (${member.id})`);
            await onMemberInActive(autokickChannel, memberData, "inactive");
        }
    }
    logger.ok("The pruning has completed.");
}

async function main(bot: Bot, module: Module) {
    //if (!module.handling) return;
    if (!autoKickConfig) autoKickConfig = new ConfigStorage(autoKickConfigManifest, bot);
    await sleep(5000); // wait 5 seconds before running (just in case any startup issues)

    await runAutokick(bot);
}

async function onMemberInActive(notificationChannel: GuildTextBasedChannel, memberData: ActivityData, reason: "inactive" | "joinInactive") {
    const { member, lastActive } = memberData;

    await notificationChannel.send({
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
                await auditLog(member.guild, `Autokick: Kicked \\*${member.user.username}\\*`, `Kicked <@${member.id}> for inactivity, action approved by <@${interaction.user.id}>`);
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

    module.addChatInteraction(async msg => {
        if (!msg.inGuild() || !msg.channel.isSendable()) return;
        if (!msg.content.startsWith("?*")) return;

        if (!bot.checkPermission(msg.guild, msg.author, "Administrator")) return;

        if (msg.content.startsWith("?*rescanactivity")) {
            const days = parseInt(msg.content.replace("?*rescanactivity ", ""));
            if (days < 1 || days > 30) {
                msg.reply(`Invalid number if days: ${days}`);
                return;
            }
            msg.reply("Checking...");
            await checkActivityInGuild(bot, msg.guild, days);
            msg.reply("Check done!");
        }
        if (msg.content === "?*runautokick") {
            msg.reply("Running...");
            await main(bot, module);
            msg.reply("Done!");
        }
    });
}

type AutoKickConfigManifest = typeof autoKickConfigManifest;

export type { AutoKickConfigManifest };