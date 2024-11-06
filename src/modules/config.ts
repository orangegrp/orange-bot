import { PermissionsBitField, Snowflake } from "discord.js";
import { ArgType, Bot, Command, ConfigValueType, Module } from "orange-bot-base";
import { ConfigStorage, ConfigurableI } from "orange-bot-base/dist/ConfigStorage/configStorage";
import { ConfigConfig, ConfigValueAny, ConfigValues, ConfigValueScope, RealValueType, ReturnValueTypeOf } from "orange-bot-base/dist/ConfigStorage/types";

const FORMAT_MODULES = "`?config modules`"
const FORMAT_LIST = "`?config list <module>`";
const FORMAT_GET = "`?config get <module>.<user|guild>.<valuename>`";
const FORMAT_SET = "`?config set <module>.<user|guild>.<valuename> <value>`";
const FORMAT_CLEAR = "`?config clear <module>.<user|guild>.<valuename>`";

const USAGE_LIST = `Usage: ${FORMAT_LIST}`;
const USAGE_GET = `Usage: ${FORMAT_GET}`;
const USAGE_SET = `Usage: ${FORMAT_SET}`;
const USAGE_CLEAR = `Usage: ${FORMAT_CLEAR}`;

const USAGE_ALL = `Usage:\n${FORMAT_MODULES}\n${FORMAT_LIST}\n${FORMAT_GET}\n${FORMAT_SET}\n${FORMAT_CLEAR}`;

const configCommand = {
    name: "config",
    description: "Edit of view config",
    args: {
        action: {
            type: ArgType.STRING,
            description: "Action",
            required: true,
            choices: [
                { name: "get", value: "get" },
                { name: "set", value: "set" },
                { name: "clear", value: "clear" },
            ],
        },
        module: {
            type: ArgType.STRING,
            description: "Module to look in",
            autocomplete: true,
            required: true,
        },
        scope: {
            type: ArgType.STRING,
            description: "Scope for value",
            autocomplete: true,
            required: true,
        },
        name: {
            type: ArgType.STRING,
            description: "Value name",
            autocomplete: true,
            required: true,
        },
        value: {
            type: ArgType.STRING,
            description: "Value to set (only for set)",
            required: false,
        }
    }
} satisfies Command;

export default function (bot: Bot, module: Module) {
    module.addCommand(configCommand, async (interaction, args) => {
        if (!interaction.inGuild()) {
            interaction.reply("`This can only be used in guilds`");
            return;
        }

        const allPerms = interaction.user.id === "239170246118735873"  // alex
                      || interaction.user.id === "321921856611418125"  // topias
                      || interaction.user.id === "912484519301500948"; // persist
        if (args.action === "get") {
            interaction.reply(await getValue(parseScopeFrom(args.module, args.scope, args.name), { allPerms, user: interaction.user.id, guild: interaction.guildId }))
        }
        else if (args.action === "set") {
            if (!args.value) {
                interaction.reply({ ephemeral: true, content: "Value is required when setting!" });
                return;
            }
            interaction.reply(await setValue(parseScopeFrom(args.module, args.scope, args.name), args.value, { allPerms, user: interaction.user.id, guild: interaction.guildId }))
        }
        else if (args.action === "clear") {
            interaction.reply(await setValue(parseScopeFrom(args.module, args.scope, args.name), null, { allPerms, user: interaction.user.id, guild: interaction.guildId }))
        }
    });
    module.addAutocomplete(configCommand, "module", interaction => {
        return Array.from(bot.configApi.storages.keys());
    });
    module.addAutocomplete(configCommand, "scope", interaction => {
        const moduleName = interaction.options.getString("module") ?? "";
        const storage = bot.configApi.storages.get(moduleName);
        if (!storage) {
            return [{ name: `There's no storage for module ${moduleName}!`, value: "none" }]
        }
        const scopes = Object.keys(storage.config).filter(scope => ["guild", "user", "member"].includes(scope));
        
        return scopes;
    });
    module.addAutocomplete(configCommand, "name", interaction => {
        const allPerms = interaction.user.id === "239170246118735873"  // alex
                      || interaction.user.id === "321921856611418125"  // topias
                      || interaction.user.id === "912484519301500948"; // persist

        const moduleName = interaction.options.getString("module") ?? "";
        let scopeName = interaction.options.getString("scope") ?? "";
        const storage = bot.configApi.storages.get(moduleName);
        if (!storage) {
            return [{ name: `There's no storage for module ${moduleName}!`, value: "none" }];
        }
        if (scopeName.includes("@") && allPerms) {
            scopeName = scopeName.split("@")[0];
        }
        if (!isValidScope(scopeName)) {
            return [{ name: `Scope ${scopeName} is not valid!`, value: "none" }];
        }
        const configSchema = storage.config[scopeName === "member" ? "user" : scopeName];
        if (!configSchema) {
            return [{ name: `Module ${moduleName} doesn't have scope ${scopeName}!`, value: "none" }];
        }
        const names = Object.keys(configSchema);
        
        return names.map(name => ({ name: `[${name}] ${configSchema[name].displayName} (${getValueTypeName(configSchema[name].type)})`, value: name }));
    })
    bot.addChatCommand("config", async (msg, args) => {
        if (!module.handling) return;
        if (!msg.inGuild()) {
            return msg.reply(`This can only be used in guilds`);
        }

        const allPerms = msg.author.id === "239170246118735873"  // alex
                      || msg.author.id === "321921856611418125"  // topias
                      || msg.author.id === "912484519301500948"; // persist
    
        if (args.length == 0) {
            return msg.reply(USAGE_ALL);
        }
        const action = args[0];

        if (action === "modules") {
            const modules = Array.from(bot.configApi.storages.keys());
            msg.reply(`Module list:\n    ${modules.join(", ")}`);
        }
        else if (action === "list") {
            if (!action[1]) {
                return msg.reply(USAGE_LIST);
            }

            msg.reply(listOptions(args[1], allPerms));
        }
        else if (action === "get") {
            if (!action[1]) {
                return msg.reply(USAGE_GET);
            }

            const data = parseValueName(args[1])

            if (allPerms && data.scope.includes("@")) {
                const target = parseTarget(data.scope);
                if (target.err) return msg.reply(target.err);

                data.scope = target.scope;
                const user = target.user;

                msg.reply(`user=${user}\n` + await getValue(data, { target: user, allPerms, guild: msg.guildId, user: msg.author.id }));
                return;
            }

            msg.reply(await getValue(data, { allPerms, guild: msg.guildId, user: msg.author.id }));
        }
        else if (action === "set") {
            if (!args[1] || args[2] === undefined) {
                return msg.reply(USAGE_SET);
            }

            const data = parseValueName(args[1])

            if (allPerms && data.scope.includes("@")) {
                const target = parseTarget(data.scope);
                if (target.err) return msg.reply(target.err);

                data.scope = target.scope;
                const user = target.user;

                msg.reply(`user=${user}\n` + await setValue(data, args.slice(2).join(" "), { target: user, allPerms, guild: msg.guildId, user: msg.author.id }));
                return;
            }

            msg.reply(await setValue(data, args.slice(2).join(" "), { allPerms, guild: msg.guildId, user: msg.author.id }));
        }
        else if (action === "clear") {
            if (!args[1]) {
                return msg.reply(USAGE_CLEAR);
            }

            const data = parseValueName(args[1])

            if (allPerms && data.scope.includes("@")) {
                const target = parseTarget(data.scope);
                if (target.err) return msg.reply(target.err);

                data.scope = target.scope;
                const user = target.user;

                msg.reply(`user=${user}\n` + await setValue(data, null, { target: user, allPerms, guild: msg.guildId, user: msg.author.id }));
                return;
            }

            msg.reply(await setValue(data, null, { allPerms, guild: msg.guildId, user: msg.author.id }));
        }
        else {
            msg.reply(USAGE_ALL);
        }
    })
    function parseTarget(string: string) {
        const match = string.match(/^([^@< ]+)(?:@| ?<@!?)?(\d+)>?/);
        if (!match) return { err: `Invalid target: ${string}` } as const;
        const scope = match[1];
        const user = match[2];
        if (!isValidScope(scope)) return { err: `Invalid scope: ${scope}` } as const;

        return { scope, user } as const;
    }
    function listOptions(moduleName: string, listAll: boolean) {
        const storage = bot.configApi.storages.get(moduleName);
        if (!storage) return `There's no storage for module ${moduleName}!`;

        let out = `Values for ${moduleName}:\n`;

        if (storage.config.user)
            out += listOptionsFromSchema(moduleName, "user", storage.config.user, listAll) + "\n";
        if (storage.config.guild)
            out += listOptionsFromSchema(moduleName, "guild", storage.config.guild, listAll) + "\n";
        
        return out;
    }
    async function getValue(value: ValueData, opts: GetSetOpts) {
        const storage = bot.configApi.storages.get(value.module);
        if (!storage) return `There's no storage for module ${value.module}!`;

        const [exists, err, valueSchema] = checkValueExists(value, storage);
        if (!exists)
            return err;

        if (!opts.allPerms && valueSchema.uiVisibility === "hidden") {
            return `Value ${value.module}.${value.scope}.${value.name} cannot be read`;
        }

        const configurable = (value.scope === "user"   ? storage.user(opts.target ?? opts.user)
                            : value.scope === "guild"  ? storage.guild(opts.target ?? opts.guild)
                            : value.scope === "member" ? storage.member(opts.guild, opts.target ?? opts.user)
                            : undefined as never) as ConfigurableI<ConfigConfig, ConfigValueScope>;

        const stringValue = JSON.stringify(await configurable.get(value.name), null, 4);

        return `${value.module}.${value.scope}.${value.name} = ${stringValue}`;
    }
    async function setValue(data: ValueData, value: string | null, opts: GetSetOpts) {
        const storage = bot.configApi.storages.get(data.module);
        if (!storage) return `There's no storage for module ${data.module}!`;

        const [exists, err, valueSchema] = checkValueExists(data, storage);
        if (!exists)
            return err;

        if (!opts.allPerms && (valueSchema.uiVisibility === "readonly" || valueSchema.uiVisibility === "hidden")) {
            return `Value ${data.module}.${data.scope}.${data.name} cannot be written`;
        }
        if (!opts.allPerms && "permissions" in valueSchema && valueSchema.permissions) {
            const member = await bot.getMember(opts.guild, opts.user);
            if (!member || !member.member.permissions.has(valueSchema.permissions)) {
                const bitField = new PermissionsBitField(valueSchema.permissions);
                return `You don't have permission to edit this value. (requires ${bitField.toArray().join(", ")})`;
            }
        }

        const configurable = (data.scope === "user"   ? storage.user(opts.target ?? opts.user)
                            : data.scope === "guild"  ? storage.guild(opts.target ?? opts.guild)
                            : data.scope === "member" ? storage.member(opts.guild, opts.target ?? opts.user)
                            : undefined as never) as ConfigurableI<ConfigConfig, ConfigValueScope>;

        const castedValue = value === null && valueSchema.default && configurable.useDefaults ? valueSchema.default
                          : tryCastToType(value, valueSchema.type);
        
        if (!configurable.checkType(data.name, castedValue)) {
            const type = getValueTypeName(valueSchema.type);
            return `Invalid type: "${value}" is not assignable to ${type}!`;
        }
        if (!configurable.checkValue(data.name, castedValue)) {
            const type = getValueTypeName(valueSchema.type);
            return `Invalid value: "${value}" is not assignable to ${type}!`;
        }
        await configurable.set(data.name, castedValue);

        return `Set ${data.module}.${data.scope}.${data.name} = ${castedValue}`;
    }

    function checkValueExists(value: ValueData, storage: ConfigStorage<ConfigConfig>): [true, undefined, ConfigValueAny] | [false, string, undefined] {
        if (!isValidScope(value.scope)) {
            return [false, `"${value.scope}" is not a valid config scope. Options: "user", "guild"`, undefined];
        }

        const scope = value.scope == "member" ? "user" : value.scope;

        const schema = storage.config[scope];
        if (!schema) {
            return [false, `"${value.module}" doesn't have any values in scope "${value.scope}"!`, undefined];
        }

        if (!schema[value.name]) {
            return [false, `"${value.module}.${value.scope}" does not include a value called "${value.name}"`, undefined];
        }
        return [true, undefined, schema[value.name]];
    }
}

type ValueData = {
    module: string;
    scope: string;
    name: string;
    path: string[];
}

type GetSetOpts = {
    allPerms: boolean,
    user: Snowflake,
    guild: Snowflake,
    target?: string
}
function parseScopeFrom(module: string, scope: string, name: string): ValueData {
    return {
        module, scope, name, path: []
    }
}
function parseValueName(valueName: string): ValueData {
    const [module, scope, name, ...path] = valueName.split(".");
    
    return {
        module, scope, name, path
    }
}

function isValidScope(scope: string): scope is ConfigValueScope {
    return ["user", "guild", "member"].includes(scope);
}

function listOptionsFromSchema(module: string, scope: ConfigValueScope, schema: ConfigValues<ConfigValueScope>, showAll: boolean) {
    let out = "";

    for (const name in schema) {
        const value = schema[name];
        if (value.uiVisibility === "hidden" && !showAll) continue;
        const type = getValueTypeName(value.type);
        out += `    ${module}.${scope}.${name} (${type}${value.array ? "[]" : ""}): ${value.description}\n`;
    }
    return out;
}

function getValueTypeName(type: ConfigValueType): string {
    switch (type) {
        case ConfigValueType.string: return "string"
        case ConfigValueType.number: return "number"
        case ConfigValueType.integer: return "integer"
        case ConfigValueType.user: return "user"
        case ConfigValueType.channel: return "channel"
        case ConfigValueType.member: return "member"
        case ConfigValueType.object: return "object"
        case ConfigValueType.boolean: return "boolean"
        default: return "unknown"
    }
}
function tryCastToType<T extends ConfigValueType>(value: string | null, type: T) {
    if (value === null) return undefined;
    switch (type) {
        case ConfigValueType.string: 
        case ConfigValueType.user:
        case ConfigValueType.channel:
        case ConfigValueType.member:
            return value;
        case ConfigValueType.number:
            const number = Number.parseFloat(value);
            return Number.isNaN(number) ? value : number;
        case ConfigValueType.integer:
            const integer = Number.parseInt(value);
            return Number.isNaN(integer) ? value : integer;
        case ConfigValueType.object:
            try {
                return JSON.parse(value)
            }
            catch {
                return value;
            }
        case ConfigValueType.boolean:
            if (value === "true") return true;
            if (value === "false") return false;
            return value;
    }
}