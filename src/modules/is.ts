import type { Bot } from "orange-bot-base";
import { ArgType, type Command } from "orange-bot-base/dist/command.js";
import sha256 from "sha256";

const command = {
    name: "is",
    description: "answers if something is",
    args: {
        question: {
            type: ArgType.STRING,
            description: "question to answer yes or no to",
            required: true
        }
    }
} as const satisfies Command;

const responses = [
    "**Absolutely not.**",
    "No.",
    "**Absolutely.**",
    "Yes."
];


export default function(bot: Bot) {
    bot.addCommand(command, (interaction, args) => {
        const question = args.question
            .toLowerCase()         // lowercase
            .trim()                // remove leading or trailing spaces
            .replace(/ +/g, " ")   // remove duplicate spaces
            .replace(/`/g, "\`")   // escape backtick
            .replace(/is +/g, ""); // make sure question doesn't start with "is" (duplicate is)

        const response = `<@!${interaction.user.id}> asked: \`is ${question}\`\nAnswer: ${magic(question)}`;

        interaction.reply({ embeds: [{ description: response }], allowedMentions: { users: [], roles: [] } });
    })
}

function magic(s: string) {
    // count number of "not" and "never" to see if the result should be inverted
    const invert = s.split(" ").filter(word => word.match(/not|never/)).length % 2 == 1;
    // remove the "not" and "never", sha256 the string
    s = sha256(s.replace(/ ?(?:not|never) ?/g, ""));
    for(var i = 0, h = 0; i < s.length; i++)
        h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    const num = Math.round(Math.sqrt(Math.abs(h))) + (invert ? 2 : 0);
    return responses[num % responses.length];
}