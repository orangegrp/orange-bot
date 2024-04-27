/// define.ts - English dictionary module for orange🟠 Bot.
/// Copyright © orangegrp 2024. All rights reserved.
/// Refactored 27/04/2024.

import type { APIEmbed } from "discord.js";
import type { Bot, Command } from "orange-bot-base";
import { ArgType } from "orange-bot-base";
import { getLogger } from "orange-common-lib";

const logger = getLogger("/define");
const command = {
    name: "define",
    description: "Get the definition for a term",
    notes: "This command uses a cloud service. Data you provide may be shared with multiple third parties, including [dictionaryapi.dev](https://dictionaryapi.dev/) (:flag_us:) and [Alphabet (Google)](https://policies.google.com/privacy) (:flag_us:).",
    args: {
        term: {
            type: ArgType.STRING,
            description: "Term to define",
            required: true
        }
    }
} satisfies Command;

type DictionaryAPIResponse = {
    word: string,
    phonetic: string,
    phonetics: {
        text: string,
        audio: string
    }[],
    meanings: {
        partOfSpeech: string,
        synonyms: string[],
        antonyms: string[]
        definitions: {
            definition: string,
            synonyms: string[],
            antonyms: string[],
            example: string
        }[]
    }[],
    license?: {
        name: string,
        url: string
    },
    sourceUrls: string[]
}[];

/**
 * Get a list of possible definitioons from Dictionary API.
 * @param term Word or phrase to define
 * @returns `DictionaryAPIResponse` object.
 */
async function getDefinitions(term: string): Promise<DictionaryAPIResponse | undefined> {
    logger.verbose(`Getting definitions for "${term}" ...`);
    const api_url = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
    const response = await fetch(api_url + encodeURIComponent(term));
    const res_json = await response.json();

    if (response.status === 404 || res_json === undefined) {
        logger.verbose(`No definition found for "${term}". Status code: ${response.status}, response: ${JSON.stringify(res_json)}`);
        return undefined;
    }
    else if (res_json[0]['meanings'].length < 1) {
        logger.verbose(`No definition found for "${term}", response: ${JSON.stringify(res_json)}. meanings.length less than 1.`);
        return undefined;
    }
    else {
        logger.verbose(`Got ${res_json[0]['meanings'].length} definitions for "${term}", returning ...`);
        return res_json as DictionaryAPIResponse;
    }
}

/**
 * Generates a text body for embedding from a `DictionaryAPIResponse`.
 * @param rawdata `DictionaryAPIResponse` object.
 * @returns `string` content ready to put into an embed.
 */
async function extractContent(rawdata: DictionaryAPIResponse): Promise<string> {
    logger.verbose("Extracting content ...");
    const data = rawdata[0];
    let body = '';
    for (let i = 0; i < Math.min(data.meanings.length, 3); i++) {
        body += `${data.phonetic ? data.phonetic + ' ' : ''} **${data.meanings[i].partOfSpeech}**\n`;
        for (let j = 0; j < Math.min(data.meanings[i].definitions.length, 6); j++) {
            const definition = data.meanings[i].definitions[j].definition;
            const example = data.meanings[i].definitions[j].example;
            body += `**${j + 1}**. ${definition}`;
            if (example !== undefined) {
                body += ` Example: *${example}*\n`;
            } else {
                body += '\n';
            }
            if (body.length > 1000) break;
        }
        if (body.length > 1000) break;
        body += '\n';
    }
    if (body.length > 1000) body = body.slice(0, 1000) + '...';
    logger.verbose(`Extracted content of length ${body.length}, returning ...`);
    return body;
}

/**
 * Creates the Discord containing the definition for the term or an error message if no definition was found.
 * @param term Word or phrase to lookup.
 * @returns `APIEmbed` object.
 */
async function getDefinitionEmbed(term: string): Promise<APIEmbed> {
    const definitions = await getDefinitions(term);

    if (definitions === undefined) {
        return {
            title: `No definition for ${term}`,
            description: 'Definition not found',
            timestamp: new Date().toISOString()
        };
    }

    return {
        title: `Definition of "${term}"`,
        description: await extractContent(definitions),
        footer: { text: `Word definitions from dictionaryapi.dev` },
        timestamp: new Date().toISOString()
    }
}

/**
 * `define.ts` - English dictionary module for orange🟠 Bot.
 * @param bot Bot object (`orange-bot-base`)
 */
export default function (bot: Bot) {
    bot.commandManager.addCommand(command, async (interaction, args) => {
        logger.verbose(`Getting definition for "${args.term}" as requested by ${interaction.user.username} (${interaction.user.id}) ...`);
        bot.noPingReply(interaction, { embeds: [await getDefinitionEmbed(args.term)] });
    });
}