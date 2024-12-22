import { Bot, ConfigStorage, Module } from "orange-bot-base";
import { AutoKickConfigManifest } from "../autokick.js";
import { Message } from "discord.js";

export default async function(bot: Bot, module: Module, config: ConfigStorage<AutoKickConfigManifest>) {

    async function setAutokick(msg: Message, args: string[], enabled: boolean) {
        if (!module.handling) return;
        if (!msg.inGuild()) return;

        const commandUser = msg.member ?? (await bot.getMember(msg.guildId, msg.author.id))?.member;

        if (!commandUser || !commandUser.permissions.has("KickMembers")) return;


        if (args.length < 1) {
            msg.reply(`Usage ${bot.prefix}${enabled ? "autokick" : "autokickoff"} <userid>`);
            return;
        }

        const member = await bot.getMember(msg.guildId, args[0]);

        if (!member) {
            msg.reply("Couldn't find member :(");
            return;
        }

        config.member(msg.guild, args[0]).set("autokick", enabled);

        msg.reply(`${enabled ? "enabled" : "disabled"} autokick for user ${member.displayName}`);
    }

    bot.addChatCommand("autokick", async (msg, args) => {
        await setAutokick(msg, args, true);
    });

    bot.addChatCommand("autokickoff", async (msg, args) => {
        await setAutokick(msg, args, false);
    });

    module.addChatInteraction(async msg => {
        if (!module.handling) return;
        if (!msg.inGuild()) return;

        const member = msg.member ?? (await bot.getMember(msg.guildId, msg.author.id))?.member;

        if (!member) return;

        const autokick = await config.member(msg.guild, msg.author).get("autokick");

        if (autokick && member.kickable) {
            member.kick();
        }
    });
}