/// pp.ts - pp module for orange🟠 Bot.
/// Copyright © orangegrp 2024. All rights reserved.
/// Refactored 27/04/2024.

import { AttachmentBuilder, GuildMemberRoleManager, Role } from "discord.js";
import type { Bot, Command, Module } from "orange-bot-base";

const roulette = new AttachmentBuilder("src/modules/russian/roulette.gif", { name: 'roulette.gif' });
const loser = new AttachmentBuilder("src/modules/russian/loser.jpg", { name: 'loser.gif' });
const click = new AttachmentBuilder("src/modules/russian/click.png", { name: 'survivor.gif' });

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
    module.addCommand(command, (interaction, args) => {
        interaction.reply({ files: [roulette] });

        // Wait for 3 seconds
        setTimeout(() => {
            const result = russian();
            interaction.editReply({ 
                    content: result ? "You are dead!" : "You survived!",
                    files: [result ? loser : click] 
                });

            // If the user lost, mute them for 5 minutes
            if (result) {
                const muted = interaction.guild?.roles.cache.find(role => role.name === "Muted");
                const member = interaction.member;

                if (member && member.roles instanceof GuildMemberRoleManager && muted instanceof Role) {
                    member.roles.add(muted);

                    // Respond with "you have been muted for 5 minutes"
                    interaction.followUp("You have been muted for 5 minutes.");

                    setTimeout(() => { 
                        if (member.roles instanceof GuildMemberRoleManager)
                             member.roles.remove(muted); 
                            interaction.followUp("You have been unmuted.");
                        }, 300000);
                }
            }
        }, 5000);
    });
}