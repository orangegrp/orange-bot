import { getLogger } from "orange-common-lib";
import { quizHandler } from "./studybot/presentation/quiz.js";
import { slideShowHandler } from "./studybot/presentation/slideshow.js";
import { ArgType, Bot, Command } from "orange-bot-base";
import studyTopic, { getTopicList } from "./studybot/study/topic.js";

const logger = getLogger("/studybot");

const study = {
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


export default function (bot: Bot) {
    bot.addCommand(study, async (interaction, args) => {
        if (args.subCommand === "study") {
            if (!args.topic)
                interaction.reply("Please specify a topic to study");
            else if (interaction.channel) {
                interaction.reply(`:book: Studying topic **${args.topic}**`);
                const message = await interaction.channel.send("...");
                studyTopic(message, args.topic);
            }
        }
        else if (args.subCommand === "quiz") {
            if (args.mode === "1v1" && !args.opponent)
                interaction.reply("Please specify an opponent");
            else
                interaction.reply("...");
        }
    });

    bot.client.on("interactionCreate", async interaction => {
        if (interaction.isButton()) {
            if (interaction.customId.startsWith("slideshow-")) {
                slideShowHandler(interaction);
            } else if (interaction.customId.startsWith("quiz-")) {
                quizHandler(interaction);
            }
        } else if (interaction.isAutocomplete()) {
            const option = interaction.options.getFocused(true);
            logger.verbose(`Autocomplete for /${interaction.commandName} ${option.name}: ${option.value}`);
            if (interaction.commandName !== "studybot" && option.name !== "topic") {
                logger.verbose(`Ignoring autocomplete for /${interaction.commandName} ${option.name}: ${option.value}`);
                return;
            }
            let choices = await getTopicList(option.value);
            await interaction.respond(
                choices.map(choice => ({ name: choice, value: choice }))
            );
        }
    });
}