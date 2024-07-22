import type { Bot, Command, Module } from "orange-bot-base";

const aboutCommand = {
    name: "about",
    description: "Shows info about the bot",
    args: {}
} as const satisfies Command;

export default function(bot: Bot, module: Module) {
    module.addCommand(aboutCommand, (interaction, args) => {
        interaction.reply({embeds: [{
            title: "Orange bot",
            description: "",
            timestamp: new Date().toISOString(),
            fields: [
                { name: "Instance", value: bot.instanceName, inline: true },
                { name: "Environment", value: bot.env, inline: true },
                { name: "Version", value: bot.version, inline: true },
                { name: "Prefix", value: bot.prefix, inline: true },
            ]
        }]});
    })
} 