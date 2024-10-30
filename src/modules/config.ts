import { Bot, ConfigValueType, Module } from "orange-bot-base";
import { ConfigValues, ConfigValueScope } from "orange-bot-base/dist/ConfigStorage/types";

const FORMAT_LIST = "`?config list <module>`";
const FORMAT_GET = "`?config get <module>.<user|guild|global>.<valuename>`";
const FORMAT_SET = "`?config set <module>.<user|guild|global>.<valuename> <value>`";

const USAGE_LIST = `Usage: ${FORMAT_LIST}`;
const USAGE_GET = `Usage: ${FORMAT_GET}`;
const USAGE_SET = `Usage: ${FORMAT_SET}`;

const USAGE_ALL = `Usage:\n${FORMAT_LIST}\n${FORMAT_GET}\n${FORMAT_SET}`;

export default function (bot: Bot, module: Module) {
    bot.addChatCommand("config", (msg, args) => {
        const allPerms = msg.author.id === "239170246118735873"  // alex
                      || msg.author.id === "321921856611418125"  // topias
                      || msg.author.id === "912484519301500948"; // persist
    
        if (args.length == 0) {
            return msg.reply(USAGE_ALL);
        }
        const action = args[0];

        if (action === "list") {
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
            //msg.reply(getValue(data));
        }
        else if (action === "set") {
            if (!args[1] || !args[2]) {
                return msg.reply(USAGE_SET);
            }

            const data = parseValueName(args[1])
            //msg.reply(setValue(data, action[2]));
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
    function getValue(value: ValueData) {

    }
    function setValue(data: ValueData, value: string) {

    }
}

type ValueData = {
    module: string;
    scope: string;
    value: string[];
}

function parseValueName(valueName: string): ValueData {
    const [module, scope, ...value] = valueName.split(".");
    
    return {
        module, scope, value
    }
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