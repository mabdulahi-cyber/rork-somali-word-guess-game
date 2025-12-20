import { createClient, SupabaseClient } from "@supabase/supabase-js";

const resolveEnv = (key: string): string | undefined => {
  return (process.env as Record<string, string | undefined>)[key];
};

let _supabase: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (_supabase) return _supabase;

  const supabaseUrl =
    resolveEnv("EXPO_PUBLIC_SUPABASE_URL") ??
    resolveEnv("VITE_SUPABASE_URL") ??
    resolveEnv("NEXT_PUBLIC_SUPABASE_URL");

  const supabaseAnonKey =
    resolveEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY") ??
    resolveEnv("VITE_SUPABASE_ANON_KEY") ??
    resolveEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "[Supabase] Missing env vars. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (or VITE_/NEXT_PUBLIC_ variants)."
    );
  }

  _supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  return _supabase;
};

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getSupabase()[prop as keyof SupabaseClient];
  },
});
