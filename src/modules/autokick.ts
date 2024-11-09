import { Bot, ConfigConfig, ConfigStorage, ConfigValueType, Module } from "orange-bot-base";
import scheduler from "node-schedule";
import { ButtonStyle, ComponentType, Guild, GuildMember, Message, SnowflakeUtil } from "discord.js";
import { sleep } from "orange-common-lib";
import { getLogger } from "orange-common-lib";

const logger = getLogger("autokick");

async function getAllPrunableMembers(guild: Guild, bot: Bot) {
    const members = await guild.members.fetch();
    return members.filter(m => m === m); // true
}

async function checkIfMemberSentMessageRecently(member: GuildMember, guild: Guild, bot: Bot, timeout: number = 1 * 1 * 24 * 60 * 60 * 1000,) {
    const channels = await guild.channels.fetch();
    for (const [_, channel] of channels) {
        if (!channel) continue;
        // this is a nicer way to filter, but sometimes it thinks it doesn't have perms and skips channels, so lets just catch the error and ignore
        //if (!(guild.members.me?.permissionsIn(channel).has("ViewChannel") && !guild.members.me?.permissionsIn(channel).has("ReadMessageHistory"))) continue;
        if (!channel.isTextBased()) continue;

        try {
            const startTime = SnowflakeUtil.generate({ timestamp: Date.now() - timeout }).toString();
            const messages = await channel.messages.fetch({ after: startTime });
            for (const [_, message] of messages.filter(m => m.author?.id === member.id)) {
                //logger.verbose(`${message.author?.displayName} on ${message.createdTimestamp} at ${Date.now() - message.createdTimestamp} in ${message.channel.name} said "${message.content}"`);
                if (Date.now() - message.createdTimestamp < timeout) return true;
            }
            await sleep(50); // add delay to prevent discord from rate limiting
        }
        catch { /* ignore */ }
    }

    return false;
}

const autoKickConfigManifest = {
    name: "autokick",
    displayName: "Autokick Notifier",
    guild: {
        autokickChannel: {
            type: ConfigValueType.channel,
            displayName: "Autokick Channel",
            description: "Channel to send autokick notifications in",
            permissions: "SendMessages"
        }
    }
} satisfies ConfigConfig;

let autoKickConfig: ConfigStorage<typeof autoKickConfigManifest> | undefined;

async function main(bot: Bot, module: Module) {
    //if (!module.handling) return;
    if (!autoKickConfig) autoKickConfig = new ConfigStorage(autoKickConfigManifest, bot);
    await autoKickConfig.waitForReady();

    await sleep(10000);

    const member_list: { member: GuildMember }[] = [];

    logger.info("Checking for members that are inactive ...");

    for (const [_, guild] of bot.client.guilds.cache) {
        const members = await getAllPrunableMembers(guild, bot);

        for (const [_, member] of members) {
            if (!member) continue;
            if (member.user.bot) continue;
            if (member.user.id === bot.client.user?.id) continue;

            const active = await checkIfMemberSentMessageRecently(member, guild, bot)
            if (active) {
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
        await onMemberInActive(bot, module, member);    
    }
}

async function onMemberInActive(bot: Bot, module: Module, member: GuildMember) {
    const notif_channel_id = await autoKickConfig?.guild(member.guild).get("autokickChannel");
    if (!notif_channel_id) { logger.error("Autokick channel not set. Cannot send notifications!"); return; }
    const notif_channel = await bot.client.channels.fetch(notif_channel_id);
    if (!notif_channel) return;

    if (notif_channel.isTextBased()) {
        await notif_channel.send({
            embeds: [{
                title: `:bell: ${member.user.username} is inactive`,
                thumbnail: { url: member.user.avatarURL() || "" },
                description: `<@${member.user.id}> has not engaged with the community recently.`,
                fields: [ { name: "Joined", value: member.joinedAt?.toUTCString() ?? "Unknown" },
                 ],
            }],
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.Button,
                            label: "Kick",
                            style: ButtonStyle.Danger,
                            customId: `ak_k_${member.id}`
                        },
                        {
                            type: ComponentType.Button,
                            label: "Pardon",
                            style: ButtonStyle.Success,
                            customId: `ak_p_${member.id}`
                        }
                    ]
                }
            ]
        });
    }
}

export default function (bot: Bot, module: Module) {
    //if (!module.handling) return;
    autoKickConfig = new ConfigStorage(autoKickConfigManifest, bot);

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

    main(bot, module);
    logger.log("Registering scheduler job ...");
    scheduler.scheduleJob("0 0 * * *", () => main(bot, module));
    logger.ok("Scheduler job registered.");
}