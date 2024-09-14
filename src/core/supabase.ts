import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { environment } from "orange-common-lib";


let supabase: SupabaseClient<any, "public", any> | undefined = undefined;

async function getSupabase() {
    if (supabase) return supabase;

    supabase = createClient(environment.SUPABASE_SERVER!, environment.SUPABASE_ANON_KEY!);
    await supabase.auth.signInWithPassword({ email: environment.SUPABASE_USERNAME!, password: environment.SUPABASE_PASSWORD! });

    return supabase;
}


export { getSupabase as supabase };