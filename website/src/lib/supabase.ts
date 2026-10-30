import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function hasSupabaseBrowserConfig(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

let client: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return (client ??= createBrowserClient(supabaseUrl, supabaseAnonKey));
}

// Importing optional legacy compatibility must not crash Firebase/public SSR.
// Actual legacy operations still require valid configuration and real auth.
export const supabase = new Proxy({} as ReturnType<typeof createBrowserClient>, {
  get(_target, property) {
    const current = getSupabaseBrowserClient();
    const value = Reflect.get(current, property, current);
    return typeof value === "function" ? value.bind(current) : value;
  },
});
