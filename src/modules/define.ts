import type { APIEmbed } from "discord.js";
import type { Bot, Command } from "orange-bot-base";
import { ArgType } from "orange-bot-base";

const command = {
    name: "define",
    description: "Get the definition for a term",
    args: {
        term: {
            type: ArgType.STRING,
            description: "Term to define",
            required: true
        }
    }
} satisfies Command;

export default function(bot: Bot) {
    bot.commandManager.addCommand(command, async (interaction, args) => {
        bot.noPingReply(interaction, { embeds: [await getDefinition(args.term)] });
    });
}

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

async function getDefinition(term: string): Promise<APIEmbed> {
    // volk, this function is on u
    const api_url = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
    const response = await fetch(api_url + encodeURIComponent(term));
    const res_json = await response.json();

    if (response.status === 404 || res_json === undefined || res_json[0]['meanings'].length < 1) {
        return {
            title: `No definition for ${term}`,
            description: 'Definition not found',
        };
    }
    
    const data = (res_json as DictionaryAPIResponse)[0];
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

    return {
        title: `Definition of "${term}"`,
        description: body,
        footer: { text: `Definitions from dictionaryapi.dev` }
    }
}

export { getDefinition };