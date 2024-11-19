/// pp.ts - pp module for orange🟠 Bot.
/// Copyright © orangegrp 2024. All rights reserved.
/// Refactored 27/04/2024.

import { AttachmentBuilder, GuildMemberRoleManager, Role } from "discord.js";
import type { Bot, Command, Module } from "orange-bot-base";

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
                const muted = interaction.guild?.roles.cache.find(role => role.name === "Muted");
                const member = interaction.member;

                if (member && member.roles instanceof GuildMemberRoleManager && muted instanceof Role) {
                    member.roles.add(muted);

                    // Respond with "you have been muted for 5 minutes"
                    await interaction.followUp({
                        content: "You have been muted for 5 minutes.",
                        ephemeral: true
                    });

                    setTimeout(async () => { 
                        if (member.roles instanceof GuildMemberRoleManager)
                             member.roles.remove(muted); 
                            await interaction.followUp(
                                { 
                                    content: "You have been unmuted.", 
                                    ephemeral: true 
                                });
                        }, 300000);
                }
            }
        }, 5000);
    });
}