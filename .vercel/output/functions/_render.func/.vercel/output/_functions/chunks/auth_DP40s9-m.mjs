import { supabase } from './supabase_DD4i_ZTA.mjs';

async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return null;
    }
    const { data: profile } = await supabase.from("users_profile").select("*").eq("id", user.id).single();
    return {
      ...user,
      profile
    };
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

export { getCurrentUser as g };
