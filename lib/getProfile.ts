import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** Fetches the signed-in user's profile row (email + role). Assumes middleware already enforced auth. */
export async function getProfile(): Promise<{ profile: Profile | null; userId: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { profile: null, userId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return { profile: profile as Profile | null, userId: user.id };
}
