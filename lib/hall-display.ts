import { candidateClassLabel } from "@/lib/candidate-class";
import type { Candidate, CountEntry, CountRound, LivePost, Post } from "@/lib/types";
import { countedBallotsFromRounds, liveCountedBallots, rankByVotesThenName, resolveSeats } from "@/lib/utils";

export type HallDisplayCandidate = {
  id: string;
  name: string;
  panel: string;
  classLabel: string | null;
  votes: number;
  slotVotes: number[];
};

export type HallDisplayPost = {
  id: string;
  name: string;
  seats: number;
  votesPolled: number;
  displayOrder: number;
  displayReleased: boolean;
  displayReleasedAt: string | null;
  releasedRounds: number;
  countedBallots: number;
  rounds: number;
  finalised: boolean;
  invalid: number;
  invalidSlots: number[];
  candidates: HallDisplayCandidate[];
};

function emptySlots(seats: number) {
  return Array.from({ length: Math.max(seats, 1) }, () => 0);
}

function addSlots(current: number[], extra: number[] | null | undefined) {
  const next = [...current];
  for (let slot = 0; slot < next.length; slot += 1) {
    next[slot] += extra?.[slot] ?? 0;
  }
  return next;
}

export function buildHallDisplayPosts(
  posts: Post[],
  candidates: Candidate[],
  rounds: CountRound[],
  entries: CountEntry[],
  countedStatuses: Array<CountRound["status"]>,
): HallDisplayPost[] {
  const counted = rounds.filter((round) => countedStatuses.includes(round.status));

  return [...posts]
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "en"))
    .map((post) => {
      const postRounds = counted.filter((round) => round.post_id === post.id);
      const postCandidates = candidates
        .filter((candidate) => candidate.post_id === post.id)
        .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "en"));
      const votes = Object.fromEntries(postCandidates.map((candidate) => [candidate.id, 0]));
      const slotVotes = Object.fromEntries(postCandidates.map((candidate) => [candidate.id, emptySlots(post.seats)]));
      let invalid = 0;
      let invalidSlots = emptySlots(post.seats);

      for (const round of postRounds) {
        invalid += round.invalid_votes ?? 0;
        invalidSlots =
          round.invalid_slot_votes && round.invalid_slot_votes.length > 0
            ? addSlots(invalidSlots, round.invalid_slot_votes)
            : addSlots(invalidSlots, post.seats > 1 ? [round.invalid_votes ?? 0] : [round.invalid_votes ?? 0]);
        for (const entry of entries.filter((item) => item.round_id === round.id)) {
          votes[entry.candidate_id] = (votes[entry.candidate_id] ?? 0) + entry.votes;
          const current = slotVotes[entry.candidate_id] ?? emptySlots(post.seats);
          if (entry.slot_votes && entry.slot_votes.length > 0) {
            slotVotes[entry.candidate_id] = addSlots(current, entry.slot_votes);
          } else if (post.seats <= 1) {
            current[0] = (current[0] ?? 0) + entry.votes;
            slotVotes[entry.candidate_id] = current;
          }
        }
      }

      if (post.seats <= 1 && invalidSlots.every((value) => value === 0) && invalid > 0) {
        invalidSlots = [invalid];
      }

      const ranked = rankByVotesThenName(
        postCandidates.map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          panel: candidate.panel_name || "Independent",
          classLabel: candidateClassLabel(candidate.branch, candidate.year, candidate.semester),
          votes: votes[candidate.id] ?? 0,
          slotVotes: slotVotes[candidate.id] ?? emptySlots(post.seats),
        })),
        (row) => row.votes,
        (row) => row.name,
      );
      const countedBallots = countedBallotsFromRounds(postRounds, entries, post.seats);
      const polled = post.votes_polled ?? 0;

      return {
        id: post.id,
        name: post.name,
        seats: post.seats,
        votesPolled: polled,
        displayOrder: post.display_order,
        displayReleased: Boolean(post.display_released),
        displayReleasedAt: post.display_released_at ?? null,
        releasedRounds:
          typeof post.display_released_rounds === "number"
            ? post.display_released_rounds
            : post.display_released
              ? postRounds.length
              : 0,
        countedBallots,
        rounds: postRounds.length,
        finalised: polled > 0 && countedBallots >= polled,
        invalid,
        invalidSlots,
        candidates: ranked,
      };
    });
}

export function hallDisplayLeaders(post: HallDisplayPost) {
  return resolveSeats(post.candidates, post.seats, (candidate) => candidate.votes);
}

export function countedHallRounds(post: Pick<LivePost, "verified_rounds" | "pending_rounds">, requireVerification: boolean) {
  return post.verified_rounds + (requireVerification ? 0 : post.pending_rounds);
}

export function hallDisplayFromLive(post: LivePost, requireVerification: boolean): HallDisplayPost {
  const rounds = countedHallRounds(post, requireVerification);
  const countedBallots = liveCountedBallots(post);
  const releasedRounds =
    typeof post.display_released_rounds === "number"
      ? post.display_released_rounds
      : post.display_released
        ? rounds
        : 0;

  return {
    id: post.id,
    name: post.name,
    seats: post.seats,
    votesPolled: post.votes_polled ?? 0,
    displayOrder: post.display_order,
    displayReleased: Boolean(post.display_released),
    displayReleasedAt: null,
    releasedRounds,
    countedBallots,
    rounds,
    finalised: post.is_finalised,
    invalid: post.invalid_votes ?? 0,
    invalidSlots:
      post.invalid_slot_votes && post.invalid_slot_votes.length > 0
        ? post.invalid_slot_votes
        : post.seats > 1
          ? Array.from({ length: post.seats }, (_, slot) => (slot === 0 ? post.invalid_votes ?? 0 : 0))
          : [post.invalid_votes ?? 0],
    candidates: rankByVotesThenName(
      (post.candidates ?? []).map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        panel: candidate.panel_name || "Independent",
        classLabel: candidateClassLabel(candidate.branch, candidate.year, candidate.semester),
        votes: candidate.votes ?? 0,
        slotVotes: Array.isArray(candidate.slot_votes) ? candidate.slot_votes : [],
      })),
      (row) => row.votes,
      (row) => row.name,
    ),
  };
}

export function hallNeedsForward(post: HallDisplayPost) {
  return post.countedBallots > 0 && (!post.displayReleased || post.rounds > post.releasedRounds);
}
