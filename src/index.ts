import { initEnv, miniLog } from "orange-common-lib";

initEnv().then(() => {
    miniLog("Starting Orange Bot...", "Log");
}).catch(() => {
    miniLog("Something went wrong! Staring Orange Bot anyway...", "Warning");
}).finally(async () => {
    const main = await import("./bot.js");
    await main.default();
});