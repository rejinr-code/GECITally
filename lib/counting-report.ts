import { candidateClassLabel } from "@/lib/candidate-class";
import { academicYearSpan, slashDate } from "@/lib/result-report";
import type { Candidate, CountEntry, CountRound, Election, Post, Profile } from "@/lib/types";
import { ballotMarkCount, marksToBallots, officerDisplayName, ordinalMark } from "@/lib/utils";

export type CountingReportCandidate = {
  id: string;
  name: string;
  panel: string;
  classLabel: string;
};

export type CountingReportRound = {
  roundNumber: number;
  status: "pending_verification" | "verified";
  votes: Record<string, number>;
  slotVotes: Record<string, number[]>;
  invalid: number;
  invalidSlots: number[];
  ballots: number;
};

export type CountingReportSheet = {
  postId: string;
  staffId: string;
  postName: string;
  seats: number;
  marksPerBallot: number;
  votesPolled: number;
  countedBallots: number;
  complete: boolean;
  supervisorName: string;
  candidates: CountingReportCandidate[];
  rounds: CountingReportRound[];
  totals: {
    votes: Record<string, number>;
    slotVotes: Record<string, number[]>;
    invalid: number;
    invalidSlots: number[];
    ballots: number;
  };
  pendingRounds: number;
};

export type CountingReport = {
  electionName: string;
  electionDate: string;
  academicYear: string;
  issuedOn: string;
  returningOfficerName: string;
  sheets: CountingReportSheet[];
};

const COUNTED_STATUSES = new Set(["verified", "pending_verification"]);

function emptySlots(seats: number) {
  return Array.from({ length: ballotMarkCount(seats) }, () => 0);
}

function addSlots(base: number[], extra: number[]) {
  return base.map((value, slot) => value + (extra[slot] ?? 0));
}

export function invalidColumnLabels(seats: number) {
  const marks = ballotMarkCount(seats);
  if (marks <= 1) return ["Invalid"];
  return Array.from({ length: marks }, (_, slot) => `Invalid ${ordinalMark(slot)}`);
}

export function buildCountingReport(input: {
  election: Pick<Election, "name" | "date" | "returning_officer_name">;
  posts: Post[];
  candidates: Candidate[];
  rounds: Array<
    Pick<
      CountRound,
      | "id"
      | "post_id"
      | "staff_id"
      | "round_number"
      | "status"
      | "invalid_votes"
      | "invalid_slot_votes"
    >
  >;
  entries: Array<Pick<CountEntry, "round_id" | "candidate_id" | "votes" | "slot_votes">>;
  people: Array<Pick<Profile, "id" | "full_name" | "role">>;
  issuedOn?: string;
}): CountingReport {
  const names = new Map(input.people.map((person) => [person.id, person.full_name.trim()]));
  const posts = [...input.posts].sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "en"));
  const sheets: CountingReportSheet[] = [];

  for (const post of posts) {
    const candidates = input.candidates
      .filter((candidate) => candidate.post_id === post.id)
      .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name, "en"));
    const reportCandidates: CountingReportCandidate[] = candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      panel: candidate.panel_name || "Independent",
      classLabel: candidateClassLabel(candidate.branch, candidate.year, candidate.semester),
    }));
    const postRounds = input.rounds.filter(
      (round) => round.post_id === post.id && COUNTED_STATUSES.has(round.status),
    );
    const staffIds = [...new Set(postRounds.map((round) => round.staff_id))];
    staffIds.sort((a, b) => (names.get(a) ?? "").localeCompare(names.get(b) ?? "", "en"));

    for (const staffId of staffIds) {
      const marks = ballotMarkCount(post.seats);
      const rounds: CountingReportRound[] = postRounds
        .filter((round) => round.staff_id === staffId)
        .sort((a, b) => a.round_number - b.round_number)
        .map((round) => {
          const votes: Record<string, number> = {};
          const slotVotes: Record<string, number[]> = {};
          for (const candidate of candidates) {
            votes[candidate.id] = 0;
            slotVotes[candidate.id] = emptySlots(post.seats);
          }
          for (const entry of input.entries.filter((item) => item.round_id === round.id)) {
            votes[entry.candidate_id] = (votes[entry.candidate_id] ?? 0) + entry.votes;
            const current = slotVotes[entry.candidate_id] ?? emptySlots(post.seats);
            if (entry.slot_votes && entry.slot_votes.length > 0) {
              slotVotes[entry.candidate_id] = addSlots(current, entry.slot_votes);
            } else if (marks <= 1) {
              current[0] = (current[0] ?? 0) + entry.votes;
              slotVotes[entry.candidate_id] = current;
            }
          }
          const invalidSlots =
            round.invalid_slot_votes && round.invalid_slot_votes.length > 0
              ? addSlots(emptySlots(post.seats), round.invalid_slot_votes)
              : marks <= 1
                ? [round.invalid_votes ?? 0]
                : emptySlots(post.seats).map((value, slot) => (slot === 0 ? (round.invalid_votes ?? 0) : value));
          const candidateVotes = Object.values(votes).reduce((sum, value) => sum + value, 0);
          const invalid = invalidSlots.reduce((sum, value) => sum + value, 0);
          return {
            roundNumber: round.round_number,
            status: round.status === "pending_verification" ? "pending_verification" : "verified",
            votes,
            slotVotes,
            invalid,
            invalidSlots,
            ballots: marksToBallots(candidateVotes + invalid, post.seats),
          };
        });

      const totals = {
        votes: Object.fromEntries(candidates.map((candidate) => [candidate.id, 0])) as Record<string, number>,
        slotVotes: Object.fromEntries(candidates.map((candidate) => [candidate.id, emptySlots(post.seats)])) as Record<
          string,
          number[]
        >,
        invalid: 0,
        invalidSlots: emptySlots(post.seats),
        ballots: 0,
      };
      for (const round of rounds) {
        for (const candidate of candidates) {
          totals.votes[candidate.id] += round.votes[candidate.id] ?? 0;
          totals.slotVotes[candidate.id] = addSlots(
            totals.slotVotes[candidate.id] ?? emptySlots(post.seats),
            round.slotVotes[candidate.id] ?? emptySlots(post.seats),
          );
        }
        totals.invalid += round.invalid;
        totals.invalidSlots = addSlots(totals.invalidSlots, round.invalidSlots);
        totals.ballots += round.ballots;
      }

      sheets.push({
        postId: post.id,
        staffId,
        postName: post.name,
        seats: post.seats,
        marksPerBallot: marks,
        votesPolled: post.votes_polled ?? 0,
        countedBallots: totals.ballots,
        complete: (post.votes_polled ?? 0) > 0 && totals.ballots >= (post.votes_polled ?? 0),
        supervisorName: names.get(staffId) || "Counting Supervisor",
        candidates: reportCandidates,
        rounds,
        totals,
        pendingRounds: rounds.filter((round) => round.status === "pending_verification").length,
      });
    }
  }

  return {
    electionName: input.election.name,
    electionDate: slashDate(input.election.date),
    academicYear: academicYearSpan(input.election.date),
    issuedOn: input.issuedOn ?? slashDate(new Date()),
    returningOfficerName: officerDisplayName(input.election, input.people) || "Returning Officer",
    sheets,
  };
}
