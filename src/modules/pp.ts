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

export default function(bot: Bot) {
    bot.commandManager.addCommand(command, (interaction, args) => {
        interaction.reply({ content: pp(args.person?.id), allowedMentions: { users: [] } });
    });
}

function pp(id: string | undefined, min: number = 1, max: number = 50) {
    const count = Math.floor(Math.random() * (max - min)) + min;

    let p = '8';

    for (let i = 0; i < count; i++)
        p += '=';

    p += 'D';

    if (id)
        return `<@${id}>'s pp ${p}`;

    return p;
}