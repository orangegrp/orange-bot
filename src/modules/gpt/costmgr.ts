import pocketbase from "pocketbase";
import { getLogger } from "orange-common-lib";
import { sleep } from "orange-bot-base";

const logger = getLogger("costMgr");
var pb: pocketbase;

type ora_user = {
    id: string;
    user_id: string,
    name: string,
    banned: boolean,
    daily_cost: number,
    daily_cost_cap: number,
    total_cost: number,
    total_requests: number,
    total_tokens: number,
    created: Date,
    updated: Date
};

async function initDb() {
    return;
    
    logger.info(`Connecting to pocketbase...`);
    pb = new pocketbase(`https://${process.env.PB_DOMAIN!}`);

    logger.log(`Authenticating with pocketbase using username "${process.env.PB_USERNAME!}" and password "${new Array(process.env.PB_PASSWORD!.length + 1).join('*')}"...`);

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

    while (!pb.authStore.isValid) {
        await sleep(1000);
        continue;
    }
}

async function getOraUser(user_id: string): Promise<ora_user | undefined> {
    try {
        const query = `user_id = '${user_id}'`;
        const result = await pb.collection("ora_users").getFirstListItem<ora_user>(query);
        return result;
    } catch (err: any) {
        logger.warn(`Failed to get user with snowflake ${user_id}`);
        logger.error(err);
        return undefined;
    }
}

async function resetAllDailyCaps() {
    const users = await pb.collection("ora_users").getFullList<ora_user>();
    for (const user of users) {
        logger.log(`Resetting daily cost cap for user ${user.user_id}...`);
        await updateOraUser(user.user_id, { daily_cost: 0 });
    }
}

async function createOraUser(user_id: string, name: string): Promise<string | undefined> {
    try {
        const user = await pb.collection("ora_users").create<ora_user>(
            { 
                user_id: user_id,
                name: name,
                banned: false,
                daily_cost: 0,
                daily_cost_cap: Number(process.env.OPENAI_DAILY_COST_CAP),
                total_cost: 0,
                total_requests: 0,
                total_tolens: 0
            }
            );
        return user.id;
    } catch (err: any) {
        logger.warn(`Failed to create user with snowflake ${user_id}`);
        logger.error(err);
        return undefined;
    }
}

async function updateOraUser(user_id: string, data: Partial<ora_user>): Promise<boolean> {
    try {
        const user = await getOraUser(user_id);
        if (!user)
            return false;

        await pb.collection("ora_users").update<ora_user>(user.id, data);
        return true;
    } catch (err: any) {
        logger.warn(`Failed to update user with snowflake ${user_id}`);
        logger.error(err);
        return false;
    }
}

async function allowUser(user_id: string): Promise<boolean> {
    logger.log(`Checking if user ${user_id} is allowed to use GPT (404 error may happen) ...`);

    const user = await getOraUser(user_id);

    if (user === undefined) {
        return false;
    }
    if (user.banned) {
        return false;
    }
    if (Date.now() - new Date(user.updated).getTime() >= 24 * 60 * 60 * 1000) {
        if (await updateOraUser(user_id, { daily_cost: 0 })) {
            return allowUser(user_id);
        }
    }
    if (user.daily_cost >= user.daily_cost_cap)
        return false;

    return true;
}

function calculateCost(sys_prompt_tokens: number, input_tokens: number, output_tokens: number): {
    total_tokens: number,
    input_cost: number,
    output_cost: number,
    total_cost: number
} {
    const cost_per_1k_usd_input = Number(process.env.OPENAI_INPUT_COST!);
    const cost_per_1k_usd_output = Number(process.env.OPENAI_OUTPUT_COST!);
    const total_tokens = input_tokens + output_tokens;

    const input_cost = ((input_tokens + sys_prompt_tokens) / 1000) * cost_per_1k_usd_input;
    const output_cost = (output_tokens / 1000) * cost_per_1k_usd_output;
    const total_cost = input_cost + output_cost;

    return { total_tokens, input_cost, output_cost, total_cost };
}

export { initDb, allowUser, getOraUser, updateOraUser, createOraUser, calculateCost, ora_user, resetAllDailyCaps };