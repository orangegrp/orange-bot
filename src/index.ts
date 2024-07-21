import { initEnv, log } from "orange-common-lib";

initEnv().then(() => {
    log("Starting Orange Bot...", "Log");
}).catch(() => {
    log("Something went wrong! Staring Orange Bot anyway...", "Warning");
}).finally(async () => {
    const main = await import("./bot.js");
    await main.default();
});