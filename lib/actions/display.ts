"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setPostDisplayRelease(postId: string, release: boolean) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated." };

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin" && profile?.role !== "supervisor") {
      return { error: "Only an admin or Returning Officer can control the hall display." };
    }

    const { error } = await supabase.rpc("set_post_display_release", {
      p_post_id: postId,
      p_release: release,
    });

    if (error) {
      if (
        error.message.includes("display_released") ||
        error.message.includes("set_post_display_release") ||
        error.message.includes("schema cache")
      ) {
        return {
          error:
            "Run supabase/migrations/0021_display_released.sql and 0022_display_released_rounds.sql in the Supabase SQL editor first.",
        };
      }
      return { error: error.message };
    }

    revalidatePath("/display-control");
    revalidatePath("/admin");
    revalidatePath("/supervisor");
    revalidatePath("/results");
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update the hall display." };
  }
}
