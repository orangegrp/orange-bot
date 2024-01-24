import { EmbedBuilder } from "discord.js";
import type { Bot, Command } from "orange-bot-base";
import { ArgType } from "orange-bot-base";

const command = {
    name: "urban",
    description: "Get Urban dictionary definition for a word",
    args: {
        word: {
            type: ArgType.STRING,
            description: "Word or phrase"
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
                title: `Urban dictionary - "${args.word}"`,
                description: "No definition found for that term. Try another term, or check the spelling of the term you entered."
            }]});
            return;
        }

        const definition = body.list[0];

        definition.definition = definition.definition?.replace(/\[([\w\s]+)\]/g, (_, word: string) => `[${word}](http://${word.replace(/\s/g, "-")}.urbanup.com/)`);
        
        const embed = new EmbedBuilder({
            title: "Urban dictionary - " + definition.word,
            url: definition.permalink,
            description: definition.definition,
            timestamp: definition.written_on,
            footer: definition.author ? {
                text: definition.author,
            } : undefined
        }); 

        if (definition.example !== undefined && definition.example.length > 0) {
            embed.addFields( { name: "Example", value: definition.example.replace(/\[([\w\s]+)\]/g, (_, word: string) => `[${word}](http://${word.replace(/\s/g, "-")}.urbanup.com/)`) } );
        }

        if (definition.thumbs_up && definition.thumbs_down) {
            embed.addFields({ name: 'Rating', value: `:thumbsup: ${definition.thumbs_up} :thumbsdown: ${definition.thumbs_down}`} );
        }

        interaction.reply({embeds: [embed]});
    });
}
