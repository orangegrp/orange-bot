import type { Bot } from "orange-bot-base";
import { ArgType, type Command } from "orange-bot-base/dist/command.js";

const command = {
    name: "urban",
    description: "get urban dictionary definition for a word",
    args: {
        word: {
            type: ArgType.STRING,
            description: "word (or phrase) to define"
        }
    }
} as const satisfies Command;

type UrbanResponse = {
    list?: UrbanDefinition[];
};
type UrbanDefinition = {
    author?: string;
    current_vote?: string;
    defid?: number;
    definition?: string;
    example?: string;
    permalink?: string;
    thumbs_down?: number;
    thumbs_up?: number;
    word?: string;
    written_on?: string;
}

export default function(bot: Bot) {
    bot.addCommand(command, async (interaction, args) => {
        const res = await fetch(`http://api.urbandictionary.com/v0/define?term=${args.word}`);

        const body = await res.json() as UrbanResponse;

        if (!body.list || !(body.list instanceof Array)) throw new Error("Invalid response from urbandict api.");

        if (!body.list[0]) {
            interaction.reply({embeds: [{
                title: "urban dictionary",
                description: "definition "
            }]});
            return;
        }

        const definition = body.list[0];

        definition.definition = definition.definition?.replace(/\[([\w\s]+)\]/g, (_, word: string) => `[${word}](http://${word.replace(/\s/g, "-")}.urbanup.com/)`);
        
        interaction.reply({embeds: [{
            title: "Urban dictionary - " + definition.word,
            url: definition.permalink,
            description: definition.definition,
            timestamp: definition.written_on,
            footer: definition.author ? {
                text: definition.author,
            } : undefined
        }]});
    });
}
