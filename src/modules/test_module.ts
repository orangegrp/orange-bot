import { ConfigValueType, type Bot, ConfigConfig, ConfigStorage } from "orange-bot-base";
import { ArgType, type Command } from "orange-bot-base/dist/command.js";

const command2 = {
    name: "test",
    description: "test",
    options: {
        set: {
            description: "set",
            args: {
                test: {
                    description: "test",
                    type: ArgType.STRING,
                    required: true,
                }
            }
        },
        get: {
            description: "get",
            args: {}
        }
    },
} satisfies Command;

const configconfig = {
    name: "testing_idk",
    displayName: "test test",
    user: {
        age: {
            displayName: "Age",
            description: "your age",
            minValue: 0,
            maxValue: 100,
            type: ConfigValueType.integer,
        },
        name: {
            displayName: "Name",
            description: "your name",
            type: ConfigValueType.string,
            default: "orange"
        },
        score: {
            displayName: "Score",
            description: "score",
            type: ConfigValueType.number,
            minValue: 0,
            uiVisibility: "readonly"
        },
        orangeCounts: {
            displayName: "Orange counts",
            description: "counts of oranges",
            type: ConfigValueType.number,
            maxCount: 3,
            array: true,
            default: [1, 2]
        }
    },
    global: {
        orange: {
            displayName: "orange",
            description: "orange",
            type: ConfigValueType.string,
        }
    },
    guild: {
        something: {
            displayName: "Admin",
            description: "Admin",
            type: ConfigValueType.channel,
            default: "213093210",
            permissions: "Administrator"
        },
        admin: {
            displayName: "Admin",
            description: "admin",
            type: ConfigValueType.channel,
            permissions: "Administrator",
        }
    }
} satisfies ConfigConfig


export default function (bot: Bot) {
    const config = new ConfigStorage(configconfig, bot)

    bot.addChatCommand("test", (msg, args) => {
        msg.reply("orange");
    });
    bot.addCommand(command2, async (interaction, args) => {
        const user = config.user(interaction.user);
        if (args.subCommand == "get") {
            interaction.reply(`hi ${await user.get("name")}!`);
        }
        else {
            if (await user.set("name", args.test)) {
                interaction.reply("saved");
            }
            else {
                interaction.reply("not saved for reasons");
            }
        }
    })
}