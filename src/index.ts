import { initEnv } from "orange-common-lib";

initEnv().then(async () => {
    const main = await import("./bot.js");
    await main.default();
}).catch(console.error);