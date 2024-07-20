import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const envData: OrangeEnvCfg = {};
const localVars = dotenv.config();

if (localVars.parsed) {
    for (const key in localVars.parsed) {
        process.env[key] = envData[key] = localVars.parsed[key];
    }
}

if (!process.env.SUPABASE_SERVER) throw "SUPABASE_SERVER is not set!";
if (!process.env.SUPABASE_ANON_KEY) throw "SUPABASE_ANON_KEY is not set!";

const supabase = createClient(process.env.SUPABASE_SERVER, process.env.SUPABASE_ANON_KEY);

if (!supabase) throw "Failed to initialize Supabase!";

(async () => {
    if (!process.env.SUPABASE_USERNAME) throw "SUPABASE_USERNAME is not set!";
    if (!process.env.SUPABASE_PASSWORD) throw "SUPABASE_PASSWORD is not set!";

    await supabase.auth.signInWithPassword({ email: process.env.SUPABASE_USERNAME, password: process.env.SUPABASE_PASSWORD });

    const { data: remoteVars, error } = await supabase.from(`orange_bot_environment_${process.env.NODE_ENV === "production" ? "prod" : "dev"}`).select("*");

    if (error) throw error;

    if (remoteVars) {
        for (const { key, value } of remoteVars) {
            if (process.env[key] !== undefined) {
                continue;
            }
            process.env[key] = envData[key] = value;
        }
    }
})()

type OrangeEnvCfg = {
    [key: string]: string;
} & {
    STARTUP?: string;
    INSTANCE_NAME?: string;
    SUPABASE_SERVER?: string;
    SUPABASE_ANON_KEY?: string;
    SUPABASE_USERNAME?: string;
    SUPABASE_PASSWORD?: string;
    NODE_ENV?: string;
    DISCORD_WEBHOOK_LOGGER_URL?: string;
    BOT_TOKEN?: string;
    BOT_CLIENT?: string;
    FORCE_COLOR?: string;
    SSH_HOST?: string;
    SSH_PORT?: string;
    SSH_USER?: string;
    SSH_PASSWORD?: string;
    SSH_ROOT_USER?: string;
    SSH_ROOT_PASSWORD?: string;
    DEPLOY_GUILD?: string;
    DEPLOY_COMMANDS?: string;
    DEPLOY_GLOBAL?: string;
    CODERUNNER_API_KEY?: string;
    CODERUNNER_SERVER?: string;
    OPENCVE_USER?: string;
    OPENCVE_PASS?: string;
    JWT_SECRET_V1?: string;
    OPENAI_KEY?: string;
    PB_DOMAIN?: string;
    PB_USERNAME?: string;
    PB_PASSWORD?: string;
    OPENAI_INPUT_COST?: string;
    OPENAI_OUTPUT_COST?: string;
    OPENAI_DAILY_COST_CAP?: string;
    OPENAI_SHOW_PRICE?: string;
    SYS_PROMPT_TKS?: string;
    FNC_PROMPT_TKS?: string;
    SYS_PROMPT_PFX?: string;
}

export { envData as environment };