/// urban.ts - Urban Dictionary module for orange🟠 Bot.
/// Copyright © orangegrp 2024. All rights reserved.
/// Refactored 27/04/2024.

import type { Bot, Command, Module } from "orange-bot-base";
import { getLogger } from "orange-common-lib";
import { ArgType } from "orange-bot-base";
import { EmbedBuilder } from "discord.js";

const logger = getLogger("/urban");

const command = {
    name: "urban",
    description: "Get Urban dictionary definition for a word",
    notes: "This command uses a cloud service. Data you provide may be shared with Urban Dictionary LLC (:flag_us:), " +
        "subject to their [terms](https://about.urbandictionary.com/tos/) and [privacy policy](https://about.urbandictionary.com/privacy/).",
    args: {
        word: {
            type: ArgType.STRING,
            description: "Word or phrase",
            required: true
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

/**
 * Get a list of possible definitioons from Urban Dictionary API.
 * @param term Word or phrase to lookup (concated into the URL query with `encodeURIComponent`).
 * @returns `UrbanDefinition[]` if the request was successful or `undefined` if something goes wrong.
 */
async function getDefinitions(term: string) {
    logger.verbose(`Getting definitions for "${term}" ...`);
    const res = await fetch(`http://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`);
    const body = await res.json() as UrbanResponse;
    if (!body.list || !(body.list instanceof Array)) {
        logger.verbose(`Tried to look up term "${term}" but got no results. body.list was null or not an Array, returning undefined ...`);
        return undefined;
    }
    else {
        logger.verbose(`Got ${body.list?.length} definitions for "${term}", returning ...`);
        return body.list;
    }
}

/**
 * Get an embed with the **first** definition from an `UrbanDefinition[]`.
 * @param definitions List of definitions from `getDefinitions` method.
 * @returns A Discord `EmbedBuilder` object.
 */
async function getDefinition(definitions: UrbanDefinition[]) {
    logger.verbose(`Parsing definitions ...`);
    const definition = definitions[0];
    logger.verbose(`Got first definition for "${definition.word}": ${definition.definition}`);
    definition.definition = definition.definition?.replace(/\[([\w\s]+)\]/g, (_, word: string) => `[${word}](http://${word.replace(/\s/g, "-")}.urbanup.com/)`);

    const embed = new EmbedBuilder({
        title: "Urban dictionary - " + definition.word,
        url: definition.permalink,
        description: definition.definition,
        timestamp: definition.written_on,
        author: definition.author ? {
            name: definition.author,
        } : undefined,
        footer: { text: `Content from urbandictionary.com. The views/opinions expressed are that of their respective authors` },
    });

    if (definition.example !== undefined && definition.example.length > 0) {
        embed.addFields({ name: "Example", value: definition.example.replace(/\[([\w\s]+)\]/g, (_, word: string) => `[${word}](http://${word.replace(/\s/g, "-")}.urbanup.com/)`) });
    }

    if (definition.thumbs_up && definition.thumbs_down) {
        embed.addFields({ name: 'Rating', value: `:thumbsup: ${definition.thumbs_up} :thumbsdown: ${definition.thumbs_down}` });
    }

    logger.verbose(`Created embed: ${JSON.stringify(embed)}`);

    return embed;
}

/**
 * `urban.ts` - Urban Dictionary module for orange🟠 Bot.
 * @param bot Bot object (`orange-bot-base`)
 */
export default function (bot: Bot, module: Module) {
    module.addCommand(command, async (interaction, args) => {
        logger.log(`"User ${interaction.user.username} (${interaction.user.id}), looked up ${args.word}"`);
        const definitions = await getDefinitions(args.word);

        if (definitions === undefined || definitions.length === 0) {
            interaction.reply({
                embeds: [{
                    title: `Urban dictionary - "${args.word}"`,
                    description: "No definition found for that term. Try another term, or check the spelling of the term you entered.",
                    timestamp: new Date().toISOString()
                }]
            });
            logger.log(`No definition found for "${args.word}"`);
            return;
        }

        const embed = await getDefinition(definitions);
        logger.log(`The first definition for "${args.word}" as requested by ${interaction.user.username} (${interaction.user.id}) was sent.`);
        interaction.reply({ embeds: [embed] });
    });
}