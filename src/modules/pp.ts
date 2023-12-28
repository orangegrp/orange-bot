import type { Bot, ResolveCommandArgs } from "orange-bot-base"
import { ArgType, type Command } from "orange-bot-base/dist/command.js"


const command = {
    name: "pp",
    description: "show pp",
    args: {
        orange: {
            type: ArgType.USER,
            description: "person"
        }
    }
} satisfies Command

export default function(bot: Bot) {
    bot.commandManager.addCommand(command, (interaction, args: ResolveCommandArgs<typeof command>) => {
        interaction.reply(pp());
    })
}

function pp(min: number = 1, max: number = 50) {
    const count = Math.floor(Math.random() * (max - min)) + min;

    let p = '8';

    for (let i = 0; i < count; i++)
        p += '=';

    p += 'D';

    return p;
}