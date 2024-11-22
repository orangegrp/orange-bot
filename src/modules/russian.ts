/// pp.ts - pp module for orange🟠 Bot.
/// Copyright © orangegrp 2024. All rights reserved.
/// Refactored 27/04/2024.

import { AttachmentBuilder } from "discord.js";
import { ConfigStorage, ConfigValueType, type Bot, type Command, type ConfigConfig, type Module } from "orange-bot-base";

const roulette = new AttachmentBuilder("src/modules/russian/roulette.gif", { name: 'roulette.gif' });
const loser = new AttachmentBuilder("src/modules/russian/loser.jpg", { name: 'loser.jpg' });
const click = new AttachmentBuilder("src/modules/russian/click.png", { name: 'click.png' });

const command = {
    name: "russian",
    description: "Russian Roulette",
    args: {}
} satisfies Command;

const configSchema = {
    name: "russian",
    displayName: "Russian roulette",
    guild: {
        timeoutDuration: {
            displayName: "Timeout duration (minutes)",
            description: "Duration of timeout applied by russian roulette",
            permissions: "ModerateMembers",
            type: ConfigValueType.number,
            default: 5,
        }
    }
} satisfies ConfigConfig;

/**
 * Generate russian
 * @returns Mute notification
 */

const russian = () => { return Math.random() < 0.17; };

/**
 * `pp.ts` - pp module for orange🟠 Bot.
 * @param bot Bot object (`orange-bot-base`)
 */
export default async function (bot: Bot, module: Module) {
    const config = new ConfigStorage(configSchema, bot);
    await config.waitForReady();

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

        // Wait for 5 seconds
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

            // If the user lost, mute them for x minutes
            if (result) {
                const timeoutDuration = await config.guild(interaction.guildId).get("timeoutDuration");

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
                await member.timeout(timeoutDuration * 60 * 1000);
                
                await interaction.followUp({
                    content: `You have been timed out for ${timeoutDuration} minutes.`,
                    ephemeral: true
                });
            }
        }, 5000);
    });
}