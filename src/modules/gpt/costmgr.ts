import { getLogger } from "orange-common-lib";
import { pb, initDb } from "../../core/pocketbase.js";
import { Bot, ConfigConfig, ConfigStorage, ConfigValueType } from "orange-bot-base";

const logger = getLogger("costMgr");

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


const configConfig = {
    name: "assistant",
    displayName: "Assistant",
    user: {
        name: {
            displayName: "Name",
            description: "Your name",
            type: ConfigValueType.string,
        },
        banned: {
            displayName: "Banned",
            description: "Are you banned?",
            type: ConfigValueType.boolean,
            default: false,
            uiVisibility: "readonly"
        },
        dailyCost: {
            displayName: "Daily Cost",
            description: "",
            type: ConfigValueType.number,
            default: 0,
            uiVisibility: "readonly"
        },
        dailyCostCap: {
            displayName: "Daily Cost Cap",
            description: "",
            type: ConfigValueType.number,
            default: Number(process.env.OPENAI_DAILY_COST_CAP),
            uiVisibility: "readonly"
        },
        totalCost: {
            displayName: "Total Cost",
            description: "",
            type: ConfigValueType.number,
            default: 0,
            uiVisibility: "readonly"
        },
        totalRequests: {
            displayName: "Total Requests",
            description: "",
            type: ConfigValueType.number,
            default: 0,
            uiVisibility: "readonly"
        },
        totalTokens: {
            displayName: "Total Tokens",
            description: "",
            type: ConfigValueType.number,
            default: 0,
            uiVisibility: "readonly"
        },
        creationDate: {
            displayName: "Created",
            description: "",
            type: ConfigValueType.string,
            uiVisibility: "readonly"
        },
        updateDate: {
            displayName: "Updated",
            description: "",
            type: ConfigValueType.string,
            uiVisibility: "readonly"
        },
    }
} satisfies ConfigConfig


class CostMgr {
    readonly config;
    constructor(bot: Bot) {
        this.config = new ConfigStorage(configConfig, bot);
    }
    async getUser(user_id: string) {
        return this.config.user(user_id).getAll();
    }
    async userExists(user_id: string) {
        return !!await this.config.user(user_id).get("creationDate");
    }

    async resetAllDailyCaps() {
        await this.config.setAllUsers("dailyCost", 0)
    }

    async createOraUser(user_id: string, name: string): Promise<string | undefined> {
        try {
            this.config.user(user_id).setMany({ 
                creationDate: new Date().toISOString(),
                name: name,
            });
            return user_id;
        } catch (err: any) {
            logger.warn(`Failed to create user with snowflake ${user_id}`);
            logger.error(err);
            return undefined;
        }
    }

    async allowUser(user_id: string): Promise<boolean> {
        logger.log(`Checking if user ${user_id} is allowed to use GPT (404 error may happen) ...`);

        const user = await this.config.user(user_id).getAll();

        if (!user.creationDate) {
            return false;
        }
        if (user.banned) {
            return false;
        }
        if (Date.now() - new Date(user.updateDate || "0").getTime() >= 24 * 60 * 60 * 1000) {
            await this.config.user(user_id).setMany({ updateDate: new Date().toISOString(), dailyCost: 0 });
        }
        if (user.dailyCost >= user.dailyCostCap)
            return false;

        return true;
    }

    calculateCost(sys_prompt_tokens: number, input_tokens: number, output_tokens: number): {
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
}

export { CostMgr, ora_user };