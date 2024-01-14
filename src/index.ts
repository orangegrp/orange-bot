import { Client, GatewayIntentBits } from "discord.js";
import { getLogger } from "orange-common-lib";
import { Bot } from "orange-bot-base";
import { join, dirname } from "path";
import dotenv from "dotenv";

const logger = getLogger("orange🟠 Bot");

logger.info("Starting...");

dotenv.config()

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent],
});


const bot = new Bot(client, "?", process.env.BOT_TOKEN!);

const moduleDir = join(dirname(import.meta.url), "modules");
bot.loadModules(moduleDir);

bot.login();

client.on("ready", () => {
    logger.info("Logged in as " + client.user?.username)
});