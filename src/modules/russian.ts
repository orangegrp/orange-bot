/// pp.ts - pp module for orange🟠 Bot.
/// Copyright © orangegrp 2024. All rights reserved.
/// Refactored 27/04/2024.

import { AttachmentBuilder, GuildMemberRoleManager, Role } from "discord.js";
import { ConfigStorage, ConfigValueType, type Bot, type Command, type ConfigConfig, type Module } from "orange-bot-base";

const roulette = new AttachmentBuilder("src/modules/russian/roulette.gif", { name: 'roulette.gif' });
const loser = new AttachmentBuilder("src/modules/russian/loser.jpg", { name: 'loser.jpg' });
const click = new AttachmentBuilder("src/modules/russian/click.png", { name: 'click.png' });

const command = {
    name: "russian",
    description: "Russian Roulette",
    args: {}
} satisfies Command;

/**
 * Generate russian
 * @returns Mute notification
 */

const russian = () => { return Math.random() < 0.17; };

/**
 * `pp.ts` - pp module for orange🟠 Bot.
 * @param bot Bot object (`orange-bot-base`)
 */
export default function (bot: Bot, module: Module) {
    module.addCommand(command, async (interaction, args) => {
        if (!interaction.inGuild()) {
            await bot.replyWithError(interaction, "This can't be used outside a server. :(");
            return;
        }
        await interaction.reply({ 
            files: [roulette],
            embeds: [
                {
                    title: "Let's play Russian Roulette!",
                    image: { url: "attachment://roulette.gif" },
                }
            ]
        });

        // Wait for 3 seconds
        setTimeout(async () => {
            const result = russian();
            await interaction.editReply({ 
                    files: [result ? loser : click],
                    embeds: [
                        {
                            title: result ? "You are dead!" : "You survived!",
                            image: { url: `attachment://${result ? "loser.jpg" : "click.png"}` },
                        }
                    ]
                });

            // If the user lost, mute them for 5 minutes
            if (result) {

                const member = "timeout" in interaction.member
                    ? interaction.member
                    : (await bot.getMember(interaction.guildId, interaction.user.id))?.member;

                if (!member) {
                    await bot.replyWithError(interaction, "There was an error fetching member. :(");
                    return;
                }
                if (!member.moderatable) {
                    await interaction.followUp({
                        content: "Cannot timeout this member (missing permissions). :(",
                        ephemeral: true
                    });
                    return;
                }
                await member.timeout(5 * 60 * 1000);
                
                await interaction.followUp({
                    content: `You have been timed out for 5 minutes.`,
                    ephemeral: true
                });
            }
        }, 5000);
    });
}