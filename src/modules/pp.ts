/// pp.ts - pp module for orange🟠 Bot.
/// Copyright © orangegrp 2024. All rights reserved.
/// Refactored 27/04/2024.

import type { Snowflake } from "discord.js";
import type { Bot, Command } from "orange-bot-base";
import { ArgType } from "orange-bot-base";

const command = {
    name: "pp",
    description: "Measure pp",
    args: {
        person: {
            type: ArgType.USER,
            description: "Person whose pp to measure"
        }
    }
} satisfies Command;

/**
 * Generate pp
 * @param id Snowflake identifier of the user.
 * @param min Minimum size of the pp (default is `1`).
 * @param max Maximum size of the pp (default is `50`).
 * @returns The pp string.
 */
function pp(id: Snowflake, min: number = 1, max: number = 50) {
    const count = Math.floor(Math.random() * (max - min)) + min;
    let p = '8';

    for (let i = 0; i < count; i++)
        p += '=';

    p += 'D';

    if (id)
        return `<@${id}>'s pp ${p}`;

    return p;
}

/**
 * `pp.ts` - pp module for orange🟠 Bot.
 * @param bot Bot object (`orange-bot-base`)
 */
export default function (bot: Bot) {
    bot.commandManager.addCommand(command, (interaction, args) => {
        bot.noPingReply(interaction, { content: pp(args.person?.id || interaction.user.id) });
    });
}