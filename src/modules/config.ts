import { Message } from "discord.js";
import { Bot, ConfigValueType, Module } from "orange-bot-base";
import { ConfigStorage, ConfigurableI } from "orange-bot-base/dist/ConfigStorage/configStorage";
import { ConfigConfig, ConfigValueAny, ConfigValues, ConfigValueScope, RealValueType, ReturnValueTypeOf } from "orange-bot-base/dist/ConfigStorage/types";

const FORMAT_MODULES = "`?config modules`"
const FORMAT_LIST = "`?config list <module>`";
const FORMAT_GET = "`?config get <module>.<user|guild|global>.<valuename>`";
const FORMAT_SET = "`?config set <module>.<user|guild|global>.<valuename> <value>`";

const USAGE_LIST = `Usage: ${FORMAT_LIST}`;
const USAGE_GET = `Usage: ${FORMAT_GET}`;
const USAGE_SET = `Usage: ${FORMAT_SET}`;

const USAGE_ALL = `Usage:\n${FORMAT_MODULES}\n${FORMAT_LIST}\n${FORMAT_GET}\n${FORMAT_SET}`;

export default function (bot: Bot, module: Module) {
    bot.addChatCommand("config", async (msg, args) => {
        if (!module.handling) return;

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
            msg.reply(await getValue(data, msg));
        }
        else if (action === "set") {
            if (!args[1] || !args[2]) {
                return msg.reply(USAGE_SET);
            }

            const data = parseValueName(args[1])
            msg.reply(setValue(data, args[2], msg));
        }
        else {
            msg.reply(USAGE_ALL);
        }
    })
    function listOptions(moduleName: string, listAll: boolean) {
        const storage = bot.configApi.storages.get(moduleName);
        if (!storage) return `There's no storage for module ${moduleName}!`;

        let out = `Values for ${moduleName}:\n`;

        if (storage.config.user)
            out += listOptionsFromSchema(moduleName, "user", storage.config.user, listAll) + "\n";
        if (storage.config.guild)
            out += listOptionsFromSchema(moduleName, "guild", storage.config.guild, listAll) + "\n";
        if (storage.config.global && listAll)
            out += listOptionsFromSchema(moduleName, "global", storage.config.global, listAll) + "\n";
        
        return out;
    }
    async function getValue(value: ValueData, message: Message) {
        if (!message.inGuild()) {
            return `This can only be used in guilds`;
        }
        const storage = bot.configApi.storages.get(value.module);
        if (!storage) return `There's no storage for module ${value.module}!`;

        const [exists, err] = checkValueExists(value, storage);
        if (!exists)
            return err;

        const configurable = (value.scope === "user"   ? storage.user(message.author)
                            : value.scope === "guild"  ? storage.guild(message.guild)
                            : storage.global()) as ConfigurableI<ConfigConfig, ConfigValueScope>;

        const stringValue = JSON.stringify(await configurable.get(value.name), null, 4);

        return `${value.module}.${value.scope}.${value.name} = ${stringValue}`;
    }
    function setValue(data: ValueData, value: string, message: Message) {
        if (!message.inGuild()) {
            return `This can only be used in guilds`;
        }
        const storage = bot.configApi.storages.get(data.module);
        if (!storage) return `There's no storage for module ${data.module}!`;

        const [exists, err, valueSchema] = checkValueExists(data, storage);
        if (!exists)
            return err;

        const configurable = (data.scope === "user"   ? storage.user(message.author)
                            : data.scope === "guild"  ? storage.guild(message.guild)
                            : storage.global()) as ConfigurableI<ConfigConfig, ConfigValueScope>;

        const castedValue = tryCastToType(value, valueSchema.type);
        
        if (!configurable.checkType(data.name, castedValue)) {
            const type = getValueTypeName(valueSchema.type);
            return `Invalid type: "${value}" is not assignable to ${type}!`;
        }
        if (!configurable.checkValue(data.name, castedValue)) {
            const type = getValueTypeName(valueSchema.type);
            return `Invalid value: "${value}" is not assignable to ${type}!`;
        }
        configurable.set(data.name, value);

        return `Set ${data.module}.${data.scope}.${data.name} = ${value}`;
    }

    function checkValueExists(value: ValueData, storage: ConfigStorage<ConfigConfig>): [true, undefined, ConfigValueAny] | [false, string, undefined] {
        if (!isValidScope(value.scope)) {
            return [false, `"${value.scope}" is not a valid config scope. Options: "user", "guild", "global"`, undefined];
        }

        const schema = storage.config[value.scope];
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

function parseValueName(valueName: string): ValueData {
    const [module, scope, name, ...path] = valueName.split(".");
    
    return {
        module, scope, name, path
    }
}

function isValidScope(scope: string): scope is ConfigValueScope {
    return ["user", "guild", "global"].includes(scope);
}

function listOptionsFromSchema(module: string, scope: ConfigValueScope, schema: ConfigValues<ConfigValueScope>, showAll: boolean) {
    let out = "";

    for (const name in schema) {
        const value = schema[name];
        if (value.uiVisibility === "hidden" && !showAll) continue;
        const type = getValueTypeName(value.type);
        out += `${module}.${scope}.${name} (${type}${value.array ? "[]" : ""}): ${value.description}\n`;
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
function tryCastToType<T extends ConfigValueType>(value: string, type: T) {
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