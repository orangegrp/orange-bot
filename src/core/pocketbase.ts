import { getLogger } from "orange-common-lib";
import { sleep } from "orange-bot-base";
import pocketbase from "pocketbase";
import { environment } from "orange-common-lib";


const logger = getLogger("pocketbase");
var pb: pocketbase;

async function initDb() {
    logger.info(`Connecting to pocketbase...`);
    pb = new pocketbase(`https://pocketbase-aci1.vcn1.order332.com`);
    console.log(pb);

    logger.log(`Authenticating with pocketbase using username "${environment.PB_USERNAME!}" and password "${new Array(environment.PB_PASSWORD!.length + 1).join('*')}"...`);

    pb.admins.authWithPassword(environment.PB_USERNAME!, environment.PB_PASSWORD!).then(() => {
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
    pb.collection('users').authWithPassword(environment.PB_USERNAME!, environment.PB_PASSWORD!).then(() => {
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