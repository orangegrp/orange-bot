import type { Bot, ResolveCommandArgs } from "orange-bot-base";
import { ArgType, type Command } from "orange-bot-base/dist/command.js";

const command = {
    name: "pp",
    description: "measure pp",
    args: {
        person: {
            type: ArgType.USER,
            description: "person whose pp to measure"
        }
    }
} satisfies Command;

export default function(bot: Bot) {
    bot.commandManager.addCommand(command, (interaction, args: ResolveCommandArgs<typeof command>) => {
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