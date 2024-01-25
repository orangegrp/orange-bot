import dotenv from "dotenv";
dotenv.config();

import { Client, GatewayIntentBits, MessagePayload } from "discord.js";
import { getLogger } from "orange-common-lib";
import { Bot } from "orange-bot-base";
import { join, dirname } from "path";

const logger = getLogger("orange🟠 Bot");

logger.info("Starting...");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent],
});

const INSTANCE_NAME = process.env.INSTANCE_NAME;
if (!INSTANCE_NAME) throw new Error("Environment variable \"INSTANCE_NAME\" is not set!");

const bot = new Bot(client, INSTANCE_NAME, "?", process.env.BOT_TOKEN!);

const moduleDir = join(dirname(import.meta.url), "modules");
bot.loadModules(moduleDir);

bot.login();

client.on("ready", () => {
    logger.info("Logged in as " + client.user?.username)
});


// this code is absolutely criminal
// this is used to set the colour on embeds to orange
//@ts-ignore
MessagePayload.__create = MessagePayload.create;
MessagePayload.create = (target, options) => {
    if (typeof(options) === "object" && options.embeds) {
        for (const embed of options.embeds) {
            //@ts-ignore
            if (embed.data && !embed.data.color) {
                //@ts-ignore
                embed.data.color = 0xff6723;
            }
            else if (("title" in embed || "description" in embed) && !embed.color) {
                embed.color = 0xff6723;
            }
        }
    }
    //@ts-ignore
    return MessagePayload.__create(target, options);
}