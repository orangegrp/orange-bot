/// is.ts - "is <question here>?" module for orange🟠 Bot.
/// Copyright © orangegrp 2024. All rights reserved.
/// Refactored 27/04/2024.

import type { Bot, Command, Module } from "orange-bot-base";
import { ArgType } from "orange-bot-base";
import sha256 from "sha256";

const command = {
    name: "is",
    description: "Answers if something is",
    args: {
        question: {
            type: ArgType.STRING,
            description: "Question to answer yes or no to",
            required: true
        }
    }
} as const satisfies Command;

const responses = [
    "**Absolutely not.**",
    "**No.**",
    "**Maybe.**",
    "**Absolutely.**",
    "**Yes.**"
];

/**
 * Magic function to determine the answer.
 * @param s Input string
 * @returns One of the possible `responses` based on the input.
 */
function magic(s: string) {
    // count number of "not" and "never" to see if the result should be inverted
    const invert = s.split(" ").filter(word => word.match(/not|never/)).length % 2 == 1;
    // remove the "not" and "never", sha256 the string
    s = sha256(s.replace(/ ?(?:not|never) ?/g, ""));
    for (var i = 0, h = 0; i < s.length; i++)
        h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    const num = Math.round(Math.sqrt(Math.abs(h))) + (invert ? 2 : 0);
    return responses[num % responses.length];
}

/**
 * `is.ts` - "is <question here>?" module for orange🟠 Bot.
 * @param bot Bot object (`orange-bot-base`)
 */
export default function (bot: Bot, module: Module) {
    module.addCommand(command, (interaction, args) => {
        const question = args.question
            .toLowerCase()         // lowercase
            .trim()                // remove leading or trailing spaces
            .replace(/ +/g, " ")   // remove duplicate spaces
            .replace(/`/g, "\u1fef")   // escape backtick
            .replace(/^is +/, ""); // make sure question doesn't start with "is" (duplicate is)

        const does = question.startsWith("does");
        question.replace(/^does +/, "");

        const response = `<@!${interaction.user.id}> asked: \`${does ? "does" : "is"} ${question}\`\nAnswer: ${magic(question)}`;

        interaction.reply({ embeds: [{ description: response }], allowedMentions: { users: [], roles: [] } });
    })
}