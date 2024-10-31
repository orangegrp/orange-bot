import { initEnv, miniLog, environment } from "orange-common-lib";
import { supabase } from "./core/supabase.js";
import util from "util";

import pkg from "fs-extra";
const { ensureDir, writeFile } = pkg;

async function __bootstrap_docker_alex() {
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

initEnv().then(() => {
    miniLog("Starting Orange Bot", "Log");
}).catch((e) => {
    miniLog(util.inspect(e), "Error")
    miniLog("Something went wrong! Starting Orange Bot anyway!", "Warning");
}).finally(async () => {
    if (process.env.BOOTSTRAP_ALEX === "yes") {
        try { await __bootstrap_docker_alex(); } catch (err) { console.error(err); }
    }
    const main = await import("./bot.js");
    await main.default();
});