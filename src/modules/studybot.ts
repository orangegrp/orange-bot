import { ArgType, Bot, Command, Module } from "orange-bot-base";
import { getLogger } from "orange-common-lib";
import { getClosestMatch, studyBotMaterials, studyBotQuestions } from "./studybot/resource.js";
import { playSolo, processResponse } from "./studybot/exam/solo.js";

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


export default async function(bot: Bot, module: Module) {
    module.addCommand(studybotCommand, async (interaction, args) => {
        if (args.subCommand === "study") {
            await interaction.reply("Study mode coming soon!");
        }   
        else if (args.subCommand === "exam") {
            await playSolo(interaction, args.examref);
        }
    });

    bot.client.on("interactionCreate", async interaction => {
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
        } else if (interaction.isButton()) {
            await processResponse(interaction);
        }
    });
}