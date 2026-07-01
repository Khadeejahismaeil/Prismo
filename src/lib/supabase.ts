import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client. Null when the env vars are absent, so history.ts can
 * fall back to localStorage for local dev without a Supabase project.
 *
 * Prismo has no auth yet: the anon key is public and RLS is the only guard, so
 * the `reviews` table uses a permissive policy (see the migration). Reviews are
 * effectively shared — acceptable for this single-user/demo app.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: false } }) : null;

export const REVIEWS_TABLE = "reviews";
