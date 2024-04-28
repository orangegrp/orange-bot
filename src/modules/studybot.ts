/// studybot.ts - StudyBot module for orange🟠 Bot.
/// Copyright © orangegrp 2024. All rights reserved.
/// Refactored 27/04/2024.

/// THIS IS A WORK IN PROGRESS AND IS NOT READY FOR USE!

import type { Bot, Command } from "orange-bot-base";
import { ArgType } from "orange-bot-base";
import { getLogger } from "orange-common-lib";

import { quizHandler } from "./studybot/presentation/quiz.js";
import OrangeSlideshow, { slideShowHandler } from "./studybot/presentation/slideshow.js";
import { getTopic, getTopicList } from "./studybot/topic.js";
import { AutocompleteInteraction, ButtonInteraction } from "discord.js";

import soloGame from "./studybot/games/solo.js";

const logger = getLogger("/studybot");

const command = {
    name: "studybot",
    description: "Sharpen your knowledge and tech skills with Studybot",
    options: {
        study: {
            description: "Study a topic you're struggling with using an interactive slideshow.",
            args: {
                topic: {
                    description: "Choose a topic to study",
                    type: ArgType.STRING,
                    required: true,
                    autocomplete: true
                }
            }
        },
        quiz: {
            description: "Test your knowledge with a quiz, either by yourself or with friends.",
            args: {
                mode: {
                    description: "Choose a game mode",
                    type: ArgType.STRING,
                    required: true,
                    choices: [
                        { name: "Solo", value: "solo" },
                        { name: "1v1", value: "1v1" },
                        { name: "Rapid fire (Everyone plays)", value: "rapidfire" }
                    ]
                },
                questions: {
                    description: "Choose amount of questions",
                    type: ArgType.INTEGER,
                    required: true,
                    min_value: 1,
                    max_value: 50,
                },
                topic: {
                    description: "Choose a topic to quiz (Default: all topics)",
                    type: ArgType.STRING,
                    required: false,
                    autocomplete: true
                },
                opponent: {
                    description: "Choose your opponent (1v1)",
                    type: ArgType.USER,
                    required: false
                }
            }
        }
    },
} satisfies Command;

/**
 * Autocomplete handler for command params.
 * @param interaction Interaction object.
 * @returns N/A
 */
async function handleAutoComplete(interaction: AutocompleteInteraction) {
    const option = interaction.options.getFocused(true);
    if (interaction.commandName !== "studybot" && option.name !== "topic") {
        return;
    }
    logger.log(`Autocomplete parameter requested ${option.name}: ${option.value}`);
    let choices = await getTopicList(option.value, interaction.options.getSubcommand(true) === "study" ? "slides" : "questions");
    await interaction.respond(
        choices.map(choice => ({ name: choice, value: choice }))
    );
}

/**
 * Button interaction handler.
 * @param interaction Interaction object.
 */
async function handleButtonInteraction(interaction: ButtonInteraction) {
    if (interaction.customId.startsWith("slideshow-")) {
        slideShowHandler(interaction);
    } else if (interaction.customId.startsWith("quiz-")) {
        quizHandler(interaction);
    }
}

/**
 * `studybot.ts` - StudyBot module for orange🟠 Bot.
 * @param bot Bot object (`orange-bot-base`)
 */
export default function (bot: Bot) {
    bot.addCommand(command, async (interaction, args) => {
        if (args.subCommand === "study") {
            if (!args.topic)
                interaction.reply("Please specify a topic to study");
            else if (interaction.channel) {
                interaction.reply(`:book: Studying topic **${args.topic}**`);
                const message = await interaction.channel.send("...");
                const slides = await getTopic(message, "slides", args.topic);

                if (slides !== undefined)
                    new OrangeSlideshow(slides, message);
                else
                    interaction.reply(":x: The topic wasn't found in our database.");
            }
        }
        else if (args.subCommand === "quiz") {
            if (args.mode === "1v1" && !args.opponent) 
                interaction.reply("Please specify an opponent");
            else if (interaction.channel) {
                switch (args.mode) {
                    case "solo":
                        interaction.reply(":video_game: Playing **solo mode**");
                        const message = await interaction.channel.send("...");
                        const questions = await getTopic(message, "questions", args.topic ?? "*", args.questions);

                        if (questions !== undefined)
                            soloGame(message, [interaction.user], questions, args.topic ?? "*");
                        else
                            interaction.channel.send(":x: The topic wasn't found in our database.");
                        break;
                    case "1v1":
                        interaction.reply("1v1 mode not implemented yet");
                        break;
                    case "rapidfire":
                        interaction.reply("Rapid fire mode not implemented yet");
                        break;
                }
            }
        }
    });

    bot.client.on("interactionCreate", async interaction => {
        if (interaction.isButton()) {
            await handleButtonInteraction(interaction);
        } else if (interaction.isAutocomplete()) {
            await handleAutoComplete(interaction);
        }
    });
}