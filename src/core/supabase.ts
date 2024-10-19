import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { environment } from "orange-common-lib";
import { getLogger } from "orange-common-lib";

const logger = getLogger("supabase");
let supabase: SupabaseClient<any, "public", any> | undefined = undefined;

async function getSupabase(): Promise<SupabaseClient<any, "public", any>> {
    if (supabase) return supabase;

    if (!environment.SUPABASE_SERVER) { logger.error("SUPABASE_SERVER is not set"); return supabase as any; }
    if (!environment.SUPABASE_ANON_KEY) { logger.error("SUPABASE_ANON_KEY is not set"); return supabase as any; }
    if (!environment.SUPABASE_USERNAME) { logger.error("SUPABASE_USERNAME is not set"); return supabase as any; }
    if (!environment.SUPABASE_PASSWORD) { logger.error("SUPABASE_PASSWORD is not set"); return supabase as any; }

    logger.info("Connecting to Supabase");

    supabase = createClient(environment.SUPABASE_SERVER, environment.SUPABASE_ANON_KEY);
    await supabase.auth.signInWithPassword({ email: environment.SUPABASE_USERNAME, password: environment.SUPABASE_PASSWORD });

    logger.ok("Connected to Supabase!");

    return supabase;
}

export { getSupabase as supabase };