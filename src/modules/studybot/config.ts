import { Bot, ConfigConfig, ConfigStorage, ConfigValueType } from "orange-bot-base";

const configconfig = {
    name: "stydybot",
    displayName: "Studybot",
    guild: {
        examChannel: {
            type: ConfigValueType.channel,
            displayName: "Exam channel",
            description: "Channel to start studybot exams in",
            permissions: "ManageChannels",
        }
    }
} as const satisfies ConfigConfig;

const configStorages: Map<typeof Bot.prototype.instanceName, ConfigStorage<typeof configconfig>> = new Map();

async function getConfigStorage(bot: Bot) {
    let storage = configStorages.get(bot.instanceName);
    if (!storage) {
        storage = new ConfigStorage(configconfig, bot);
        await storage.waitForReady();
    }
    return storage;
}

export { getConfigStorage }