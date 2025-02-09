import { Guild, GuildMember, RoleResolvable, Snowflake } from "discord.js";
import { ArgType, Bot, Command, ConfigConfig, ConfigStorage, ConfigValueType, Module } from "orange-bot-base";
import { getLogger } from "orange-common-lib";
import { auditLog } from "./auditlogs.js";


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
                    choices: autoroleTriggers.map(value => ({ name: autorolePrettyNames[value], value })),
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


function isValidTrigger(trigger: string): trigger is AutoroleTrigger {
    return autoroleTriggers.includes(trigger as AutoroleTrigger);
}


function stringifyAutorole(autorole: { trigger: string, role: string }, opts?: { roleName: string }) {
    const trigger = autorole.trigger;
    const prettyName = isValidTrigger(trigger) ? autorolePrettyNames[trigger] : trigger;

    if (opts?.roleName) {
        return `On \`${prettyName}\`, add role ${opts.roleName}`;
    }
    return `On \`${prettyName}\`, add role <@&${autorole.role}>`;
}


async function addRole(member: GuildMember, role: Snowflake) {
    try {
        member.roles.add(role);
    }
    catch (e: any) {
        logger.error(`Error while adding role ${role} to member ${member.user.username}(${member.id})`);
        logger.error(e);
    }
    await auditLog(member.guild, `Added role to *${member.user.username}*`, `Gave role <@&${role}> to user <@${member.id}>`);
}


export default async function (bot: Bot, module: Module) {
    const config = new ConfigStorage(configSchema, bot);


    module.addCommand(command, async (interaction, args) => {
        if (!interaction.inGuild()) {
            bot.replyWithError(interaction, "Doesn't work outside guilds!");
            return;
        }

        if (!await bot.checkPermission(interaction.guildId, interaction.member, "Administrator")) {
            bot.replyWithError(interaction, "You don't have permission to use this!");
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

        const guild = interaction.guild ?? (await bot.getGuild(interaction.guildId))?.guild;
        if (!guild) {
            return [{ value: -1, name: "An error has occurred (guild not found)" }];
        }

        const guildConfig = config.guild(interaction.guildId);

        const autoroles = await guildConfig.get("autoroles");

        return await Promise.all(autoroles.map(async (autorole, index) => {
            const role = await guild.roles.fetch(autorole.role)
            return { name: stringifyAutorole(autorole, { roleName: "`" + (role?.name ?? "unknown role") + "`" }), value: index };
        }));
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