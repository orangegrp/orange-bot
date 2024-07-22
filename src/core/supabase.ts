import { createClient } from "@supabase/supabase-js";
import { environment } from "orange-common-lib";

const supabase = createClient(environment.SUPABASE_SERVER!, environment.SUPABASE_ANON_KEY!);

(async () => {
    await supabase.auth.signInWithPassword({ email: environment.SUPABASE_USERNAME!, password: environment.SUPABASE_PASSWORD! });
})();

export { supabase };