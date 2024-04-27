import pocketbase from "pocketbase";
import { getLogger } from "orange-common-lib";
import { sleep } from "orange-bot-base";
import "dotenv/config";

const logger = getLogger("pocketbase api");
var pb: pocketbase;

async function initDb() {
    logger.info(`Connecting to pocketbase...`);
    pb = new pocketbase(`https://${process.env.PB_DOMAIN!}`);

    logger.log(`Authenticating with pocketbase using username "${process.env.PB_USERNAME!}" and password "${new Array(process.env.PB_PASSWORD!.length + 1).join('*')}"...`);

    pb.admins.authWithPassword(process.env.PB_USERNAME!, process.env.PB_PASSWORD!).then(() => {
        logger.ok('Authentication success!');
        setInterval(() => {
            pb.admins.authRefresh().then(() => logger.ok('Pocketbase session refreshed!'))
                .catch((err) => logger.error(`Failed to refresh pocketbase session! ${err}`));
        }, 60 * 60 * 1000);
    }).catch((err) => {
        logger.warn("Pocketbase authentication error!");
        logger.error(err);
        setTimeout(initDb, 5000);
    });

    /*
    pb.collection('users').authWithPassword(process.env.PB_USERNAME!, process.env.PB_PASSWORD!).then(() => {
        logger.ok('Authentication success!');
        setInterval(() => {
            logger.log('Refreshing pocketbase auth session...');
            pb.collection('users').authRefresh().then(() => logger.ok('Pocketbase session refreshed!'))
                .catch((err) => logger.error(`Failed to refresh pocketbase session! ${err}`));
        }, 60 * 60 * 1000);
    }).catch((err) => {
        logger.warn("Pocketbase authentication error!");
        logger.error(err);
        setTimeout(initDb, 5000);
    });
    */

    while (!pb.authStore.isValid) {
        await sleep(1000);
        continue;
    }
}

export { pb, initDb };