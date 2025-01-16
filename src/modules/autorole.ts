import { Guild, GuildMember, RoleResolvable } from "discord.js";
import { ArgType, Bot, Command, ConfigConfig, ConfigStorage, ConfigValueType, Module } from "orange-bot-base";
import { getLogger } from "orange-common-lib";


const logger = getLogger("autorole");


const autoroleTriggers = [
    "join",
] as const;

type AutoroleTrigger = typeof autoroleTriggers[number];


const autorolePrettyNames: { [i in AutoroleTrigger]: string } = {
    join: "member joined",
};


const configSchema = {
    name: "autorole",
    displayName: "Autorole",
    guild: {
        autoroles: {
            displayName: "Autoroles",
            description: "Triggers and roles to give",
            type: ConfigValueType.object,
            array: true,
            default: [],
            children: {
                trigger: {
                    displayName: "Autorole trigger",
                    description: "Action which triggers this autorole",
                    type: ConfigValueType.string,
                    default: ""
                },
                role: {
                    displayName: "Role",
                    description: "Role to give when this autorole gets triggered",
                    type: ConfigValueType.string,
                    default: ""
                }
            }
        }
    }
} satisfies ConfigConfig;



const command = {
    name: "autorole",
    description: "Commands to manage autorole",
    options: {
        add: {
            description: "Add a new autorole",
            args: {
                trigger: {
                    description: "Trigger for this autorole",
                    type: ArgType.STRING,
                    choices: autoroleTriggers.map(value => ({ name: value, value })),
                    required: true,
                },
                role: {
                    description: "Role to give when triggered",
                    type: ArgType.ROLE,
                    required: true,
                }
            }
        },
        list: {
            description: "List current autoroles",
            args: {}
        },
        remove: {
            description: "Delete an autorole",
            args: {
                autorole: {
                    description: "Autorole to delete",
                    type: ArgType.NUMBER,
                    autocomplete: true,
                    required: true,
                }
            }
        }
    }
} satisfies Command



function stringifyAutorole(autorole: { trigger: string, role: string }) {
    return `On \`${autorole.trigger}\`, add role <@&${autorole.role}>`;
}


async function addRole(member: GuildMember, role: RoleResolvable) {
    try {
        member.roles.add(role);
    }
    catch (e: any) {
        logger.error(`Error while adding role ${role} to member ${member.user.globalName}(${member.id})`);
        logger.error(e);
    }
}


export default async function (bot: Bot, module: Module) {
    const config = new ConfigStorage(configSchema, bot);
    await config.waitForReady();


    module.addCommand(command, async (interaction, args) => {
        if (!interaction.inGuild()) {
            bot.replyWithError(interaction, "Doesn't work outside guilds!");
            return;
        }

        const guildConfig = config.guild(interaction.guildId);

        const autoroles = await guildConfig.get("autoroles");

        if (args.subCommand === "add") {
            if (!autoroleTriggers.includes(args.trigger as AutoroleTrigger)) {
                interaction.reply(`\`${args.trigger}\` is not a valid autorole trigger!`);
                return;
            }

            const autorole = { trigger: args.trigger, role: args.role.id };

            autoroles.push(autorole);

            await guildConfig.set("autoroles", autoroles);

            interaction.reply("Successfully added autorole: " + stringifyAutorole(autorole));
        }
        else if (args.subCommand === "list") {
            interaction.reply("Current autoroles: \n\n" + autoroles.map(autorole => stringifyAutorole(autorole)).join("\n"));
        }
        else if (args.subCommand === "remove") {
            if (args.autorole < 0 || args.autorole >= autoroles.length) {
                interaction.reply(`An autorole with id "${args.autorole}" does not exist!`);
                return;
            }
            const removed = autoroles.splice(args.autorole, 1);
            
            await guildConfig.set("autoroles", autoroles);

            interaction.reply("Successfully removed autorole: " + stringifyAutorole(removed[0]));
        }
    });
    module.addAutocomplete(command, "autorole", async interaction => {
        if (!interaction.inGuild()) return [];

        const guildConfig = config.guild(interaction.guildId);

        const autoroles = await guildConfig.get("autoroles");

        return await Promise.all(autoroles.map(async (autorole, index) => ({ name: stringifyAutorole(autorole), value: index })));
    });


    bot.client.on("guildMemberAdd", async member => {
        const guildConfig = config.guild(member.guild);

        const autoroles = await guildConfig.get("autoroles");

        for (const autorole of autoroles) {
            const trigger = autorole.trigger as AutoroleTrigger;

            if (trigger === "join") {
                await addRole(member, autorole.role);
            }
        }
    });
}