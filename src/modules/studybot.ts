import { ArgType, Bot, Command, DisplayError, Module } from "orange-bot-base";
import { getLogger } from "orange-common-lib";
import { getClosestMatch, studyBotMaterials, studyBotQuestions } from "./studybot/resource.js";
import { playSolo, processResponse } from "./studybot/exam/solo.js";
import { getConfigStorage } from "./studybot/config.js";
import { Channel } from "discord.js";
import { isValidStudyBotChannel } from "./studybot/utils.js";
import { handleQuestionResponse, questionMode } from "./studybot/exam/question.js";

const logger = getLogger("/studybot");

const studybotCommand = {
    name: "studybot",
    description: "Get access to training material and fun game modes for various technical topics.",
    notes: "Study Bot is not a replacement for independent learning, neither is it a qualified or otherwise licensed educational program operator or provider. The information is derived from publicly attained materials on the Internet and may be inaccurate from time to time.",
    options: {
        exam: {
            description: "Test your knowledge using exam mode",
            args: {
                examref: {
                    type: ArgType.STRING,
                    description: "Choose the exam you'd like to take",
                    required: true,
                    autocomplete: true
                }
            }
        },
        question: {
            description: "Test your knowledge by answering a random question from an exam",
            args: {
                examref: {
                    type: ArgType.STRING,
                    description: "Choose the exam you'd like to take (or leave blank for random)",
                    required: false,
                    autocomplete: true
                }
            }
        },
        study: {
            description: "Study at your own pace using study mode",
            args: {
                matref: {
                    type: ArgType.STRING,
                    description: "Choose the study material you'd like to study",
                    required: true,
                    autocomplete: true
                }
            }
        }
    }

} satisfies Command;


export default async function (bot: Bot, module: Module) {
    const configStorage = await getConfigStorage(bot)

    module.addCommand(studybotCommand, async (interaction, args) => {
        if (!interaction.inGuild()) {
            bot.replyWithError(interaction, "DMs are not supported for StudyBot");
            return;
        }
        if (!interaction.channel) {
            throw new DisplayError("Interaction channel wasn't found");
        }
        if (!isValidStudyBotChannel(interaction.channel)) {
            interaction.reply({ ephemeral: true, content: "StudyBot can't be used on a channel of this type" });
            return;
        }

        if (args.subCommand === "study") {
            await interaction.reply("Study mode coming soon!");
        }
        else if (args.subCommand === "exam") {
            const channelId = await configStorage.guild(interaction.guildId).get("examChannel");

            let channel: Channel | null = null;
            if (channelId) {
                channel = await interaction.client.channels.fetch(channelId);
                if (channel && (!isValidStudyBotChannel(channel))) {
                    channel = null;
                }
            }
            if (!channel) {
                channel = interaction.channel
            }

            await playSolo(interaction, args.examref, channel);
        } else if (args.subCommand === "question") {
            await questionMode(args.examref ?? "", interaction);
        }
    });

    bot.client.on("interactionCreate", async interaction => {
        if (!module.handling) return;
        if (interaction.isAutocomplete()) {
            const option = interaction.options.getFocused(true);
            logger.verbose(`Autocomplete for /${interaction.commandName} ${option.name}: ${option.value}`);
            if (interaction.commandName !== "studybot" && !option.name.endsWith("ref")) {
                logger.verbose(`Ignoring autocomplete for /${interaction.commandName} ${option.name}: ${option.value}`);
                return;
            }

            let target = option.name === "examref" ? studyBotQuestions : studyBotMaterials;
            let choices = await getClosestMatch(option.value, (await target.get(null) ?? []));

            await interaction.respond(
                choices.map(choice =>
                ({
                    name: choice.replace(".json", ""),
                    value: choice
                })
                )
            )
        } else if (interaction.isButton() && interaction.customId.startsWith("sb_q_")) {
            await handleQuestionResponse(interaction);
        }
        else if (interaction.isButton() && interaction.customId.startsWith("sb_")) {
            await processResponse(interaction);
        }
    });
}