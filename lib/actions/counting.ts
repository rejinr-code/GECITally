"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isNonNegativeInt, validateRoundEntries } from "@/lib/validators";

export async function submitCountRound(
  postId: string,
  entries: Array<{ candidate_id: string; votes: number; slot_votes?: number[] }>,
  invalidVotes = 0,
  invalidSlotVotes?: number[],
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
    if (invalidSlotVotes) {
      if (!invalidSlotVotes.every((value) => isNonNegativeInt(value))) {
        return { error: "Invalid votes must be whole numbers of 0 or more." };
      }
      if (invalidSlotVotes.reduce((sum, value) => sum + value, 0) !== invalidVotes) {
        return { error: "Invalid totals do not match the 1st/2nd counts." };
      }
    }
    for (const entry of entries) {
      if (!entry.slot_votes) continue;
      if (!entry.slot_votes.every((value) => isNonNegativeInt(value))) {
        return { error: "Candidate 1st/2nd counts must be whole numbers of 0 or more." };
      }
      if (entry.slot_votes.reduce((sum, value) => sum + value, 0) !== entry.votes) {
        return { error: "Candidate 1st/2nd counts must add up to that candidate's total." };
      }
    }

    const { data, error } = await supabase.rpc("submit_count_round", {
      p_post_id: postId,
      p_entries: entries,
      p_invalid_votes: invalidVotes,
      ...(invalidSlotVotes ? { p_invalid_slot_votes: invalidSlotVotes } : {}),
    });

    if (error) {
      const message = error.message.includes("Duplicate")
        ? "Duplicate round detected. This round was already submitted."
        : error.message.includes("p_invalid_slot_votes") ||
            error.message.includes("invalid_slot_votes") ||
            error.message.includes("slot_votes") ||
            error.message.includes("schema cache")
          ? "Run supabase/migrations/0014_multi_seat_ballots.sql and 0015_candidate_slot_votes.sql in the Supabase SQL editor first."
          : error.message.includes("p_invalid_votes")
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
