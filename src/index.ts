import { initEnv, miniLog } from "orange-common-lib";
import util from "util";

initEnv().then(() => {
    miniLog("Starting Orange Bot...", "Log");
}).catch((e) => {
    miniLog(util.inspect(e), "Error")
    miniLog("Something went wrong! Staring Orange Bot anyway...", "Warning");
}).finally(async () => {
    const main = await import("./bot.js");
    await main.default();
});

// test signed commit