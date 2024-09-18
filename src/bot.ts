import { Client, GatewayIntentBits, MessagePayload } from "discord.js";
import { getLogger } from "orange-common-lib";
import { Bot } from "orange-bot-base";
import { join, dirname } from "path";
import { environment } from "orange-common-lib";
import { supabase } from "./core/supabase.js";
import pkg from "fs-extra";
const { ensureDir, writeFile } = pkg;

async function main() {
    if (process.env.BOOTSTRAP_ALEX === "yes") {
        console.log("Boostrapping orange bot...");
        const sb = await supabase();

        console.log("Ensure ./.cache/SyncHandler/ ");
        await ensureDir("./.cache/SyncHandler");

        console.log("Ensure ./config/SyncHandler/ ");
        await ensureDir("./config/SyncHandler");

        console.log("Dl config file from S3 ");
        const config_file = (await sb.storage.from("orange-bot-bootstrap").download(environment.INSTANCE_NAME! + ".json")).data;
        console.log("Write ./config/SyncHandler/p2p-config.json");
        await writeFile("./config/SyncHandler/p2p-config.json", await config_file!.text());

        console.log("Ensure ./certs/ ");
        await ensureDir("./certs");
        console.log("Dl list ");
        const cert_list = await sb.storage.from("orange-bot-bootstrap").list("certs");

        for (const cert of cert_list.data!) {
            console.log("Dl file " + cert.name);
            const cert_data = (await sb.storage.from("orange-bot-bootstrap").download("certs/" + cert.name)).data;
            console.log("Buffer file " + cert.name);
            const buffer = await cert_data!.arrayBuffer().then(buffer => Buffer.from(buffer));
            console.log("Write file to ./certs/" + cert.name);
            await writeFile("./certs/" + cert.name, buffer);
        }   
    }
    // this code is absolutely criminal
    // this is used to set the colour on embeds to orange
    //@ts-ignore
    MessagePayload.__create = MessagePayload.create;
    MessagePayload.create = (target, options) => {
        if (typeof (options) === "object" && options.embeds) {
            for (const embed of options.embeds) {
                //@ts-ignore
                if (embed.data && !embed.data.color) {
                    //@ts-ignore
                    embed.data.color = 0xff6723;
                }
                else if ("title" in embed || "description" in embed && !embed.color) {
                    embed.color = 0xff6723;
                    if (environment.NODE_ENV === "development") {
                        if (embed.footer) embed.footer.text += ` • Instance: ${bot.instanceName}`;
                        else embed.footer = { text: `Instance: ${bot.instanceName}` }
                    }
                }
                //@ts-ignore
                if (embed.data) {
                    if (environment.NODE_ENV === "development") {
                        //@ts-ignore
                        if (embed.data.footer) embed.data.footer.text += ` • Instance: ${bot.instanceName}`;
                        //@ts-ignore
                        else embed.data.footer = { text: `Instance: ${bot.instanceName}` }
                    }
                }
            }
        }
        //@ts-ignore
        return MessagePayload.__create(target, options);
    }

    const version = process.env.npm_package_version || "this is for development";
    const logger = getLogger("orange🟠 Bot");
    logger.info(`Starting (${version})...`);

    const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent],
    });

    const INSTANCE_NAME = process.env.INSTANCE_NAME;
    if (!INSTANCE_NAME)
        throw new Error("Environment variable \"INSTANCE_NAME\" is not set!");

    const bot = new Bot(client, INSTANCE_NAME, version, "?", process.env.BOT_TOKEN!);
    const moduleDir = join(dirname(import.meta.url), "modules");
    bot.loadModules(moduleDir);
    bot.login();

    client.on("ready", () => {
        logger.info("Logged in as " + client.user?.username);
    });
}

export { main };
export default main;