"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isNonNegativeInt, validateRoundEntries } from "@/lib/validators";

export async function submitCountRound(
  postId: string,
  entries: Array<{ candidate_id: string; votes: number }>,
  invalidVotes = 0,
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated." };

    if (!entries.length) return { error: "Enter counts for every candidate." };
    const invalid = validateRoundEntries(
      entries.map((entry) => entry.candidate_id),
      entries,
    );
    if (invalid) return { error: invalid };
    if (!isNonNegativeInt(invalidVotes)) return { error: "Invalid votes must be whole numbers of 0 or more." };

    const { data, error } = await supabase.rpc("submit_count_round", {
      p_post_id: postId,
      p_entries: entries,
      p_invalid_votes: invalidVotes,
    });

    if (error) {
      const message = error.message.includes("Duplicate")
        ? "Duplicate round detected. This round was already submitted."
        : error.message.includes("p_invalid_votes") || error.message.includes("schema cache")
          ? "Run supabase/migrations/0011_invalid_votes.sql in the Supabase SQL editor first."
          : error.message
              .replace("Only counting staff can submit rounds", "Only a Counting Supervisor can submit rounds")
              .replace(
                "A round is already awaiting supervisor verification",
                "A round is already awaiting Returning Officer verification",
              );
      return { error: message };
    }

    revalidatePath("/staff");
    revalidatePath(`/staff/${postId}`);
    revalidatePath("/supervisor");
    return { ok: true, round: data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not submit round." };
  }
}
