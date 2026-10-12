"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isNonNegativeInt, validateRoundEntries } from "@/lib/validators";

function asNonNegativeInts(value: unknown): number[] | null {
  const list = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.keys(value as object)
          .filter((key) => /^\d+$/.test(key))
          .sort((a, b) => Number(a) - Number(b))
          .map((key) => (value as Record<string, unknown>)[key])
      : null;
  if (!list) return null;
  const numbers = list.map((item) => Number(item));
  if (numbers.some((item) => !Number.isInteger(item) || item < 0)) return null;
  return numbers;
}

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
    const normalizedEntries = entries.map((entry) => {
      const slotVotes = asNonNegativeInts(entry.slot_votes);
      return {
        candidate_id: entry.candidate_id,
        votes: Number(entry.votes),
        ...(slotVotes ? { slot_votes: slotVotes } : {}),
      };
    });
    const invalid = validateRoundEntries(
      normalizedEntries.map((entry) => entry.candidate_id),
      normalizedEntries,
    );
    if (invalid) return { error: invalid };
    if (!isNonNegativeInt(invalidVotes)) return { error: "Invalid votes must be whole numbers of 0 or more." };
    const normalizedInvalidSlots = invalidSlotVotes ? asNonNegativeInts(invalidSlotVotes) : undefined;
    if (invalidSlotVotes && !normalizedInvalidSlots) {
      return { error: "Invalid votes must be whole numbers of 0 or more." };
    }
    if (normalizedInvalidSlots && normalizedInvalidSlots.reduce((sum, value) => sum + value, 0) !== Number(invalidVotes)) {
      return { error: "Invalid totals do not match the 1st/2nd counts." };
    }
    for (const entry of normalizedEntries) {
      if (!entry.slot_votes) continue;
      if (entry.slot_votes.reduce((sum, value) => sum + value, 0) !== entry.votes) {
        return { error: "Candidate 1st/2nd counts must add up to that candidate's total." };
      }
    }

    const { data, error } = await supabase.rpc("submit_count_round", {
      p_post_id: postId,
      p_entries: JSON.parse(JSON.stringify(normalizedEntries)),
      p_invalid_votes: Number(invalidVotes),
      ...(normalizedInvalidSlots ? { p_invalid_slot_votes: normalizedInvalidSlots } : {}),
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
