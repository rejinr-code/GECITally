import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CountForm } from "@/components/counting/count-form";
import { RoundCard } from "@/components/counting/round-card";
import type { Candidate, CountEntry, CountRound } from "@/lib/types";
import { liveDisplaySettings, marksToBallots } from "@/lib/utils";

function cumulativeRoundScores(
  rounds: CountRound[],
  entries: CountEntry[],
  candidates: Candidate[],
  seats: number,
) {
  const slotCount = Math.max(seats, 1);
  const running = new Map(candidates.map((candidate) => [candidate.id, 0]));
  const runningCandidateSlots = new Map(
    candidates.map((candidate) => [candidate.id, Array.from({ length: slotCount }, () => 0)]),
  );
  let runningInvalid = 0;
  let runningSlots: number[] = Array.from({ length: slotCount }, () => 0);
  const snapshots = new Map<
    string,
    {
      entries: Array<CountEntry & { candidate_name: string }>;
      invalid: number;
      invalidSlots: number[];
    }
  >();

  for (const round of [...rounds].sort((a, b) => a.round_number - b.round_number)) {
    const next = new Map(running);
    const nextCandidateSlots = new Map(
      [...runningCandidateSlots.entries()].map(([id, marks]) => [id, [...marks]]),
    );
    let nextInvalid = runningInvalid;
    const nextSlots = [...runningSlots];
    for (const entry of entries.filter((item) => item.round_id === round.id)) {
      next.set(entry.candidate_id, (next.get(entry.candidate_id) ?? 0) + entry.votes);
      const marks = [...(nextCandidateSlots.get(entry.candidate_id) ?? Array.from({ length: slotCount }, () => 0))];
      if (entry.slot_votes && entry.slot_votes.length > 0) {
        for (let slot = 0; slot < slotCount; slot += 1) {
          marks[slot] = (marks[slot] ?? 0) + (entry.slot_votes[slot] ?? 0);
        }
      } else if (slotCount <= 1) {
        marks[0] = (marks[0] ?? 0) + entry.votes;
      }
      nextCandidateSlots.set(entry.candidate_id, marks);
    }
    nextInvalid += round.invalid_votes ?? 0;
    const roundSlots =
      round.invalid_slot_votes && round.invalid_slot_votes.length > 0
        ? round.invalid_slot_votes
        : [round.invalid_votes ?? 0];
    for (let slot = 0; slot < nextSlots.length; slot += 1) {
      nextSlots[slot] = (nextSlots[slot] ?? 0) + (roundSlots[slot] ?? 0);
    }
    snapshots.set(round.id, {
      entries: candidates.map((candidate) => ({
        id: `${round.id}-${candidate.id}`,
        round_id: round.id,
        candidate_id: candidate.id,
        votes: next.get(candidate.id) ?? 0,
        slot_votes: nextCandidateSlots.get(candidate.id),
        candidate_name: candidate.name,
      })),
      invalid: nextInvalid,
      invalidSlots: nextSlots,
    });
    if (round.status !== "rejected") {
      running.clear();
      next.forEach((votes, id) => running.set(id, votes));
      runningCandidateSlots.clear();
      nextCandidateSlots.forEach((marks, id) => runningCandidateSlots.set(id, marks));
      runningInvalid = nextInvalid;
      runningSlots = nextSlots;
    }
  }

  return snapshots;
}

export default async function StaffPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: assignment }, { data: post }] = await Promise.all([
    supabase
      .from("staff_assignments")
      .select("id")
      .eq("staff_id", user?.id ?? "")
      .eq("post_id", postId)
      .maybeSingle(),
    supabase.from("posts").select("*").eq("id", postId).maybeSingle(),
  ]);

  if (!assignment || !post) notFound();

  const [{ data: election }, { data: candidates }, { data: rounds }] = await Promise.all([
    supabase.from("elections").select("*").eq("id", post.election_id).maybeSingle(),
    supabase.from("candidates").select("*").eq("post_id", postId).order("display_order"),
    supabase
      .from("count_rounds")
      .select("*")
      .eq("post_id", postId)
      .eq("staff_id", user?.id ?? "")
      .order("round_number", { ascending: false }),
  ]);

  const roundIds = (rounds ?? []).map((round) => round.id);
  const { data: entries } = roundIds.length
    ? await supabase.from("count_entries").select("*").in("round_id", roundIds)
    : { data: [] };

  const pending = (rounds ?? []).find((round) => round.status === "pending_verification") ?? null;
  const rejected = (rounds ?? []).find((round) => round.status === "rejected") ?? null;
  const countedBallots = (rounds ?? [])
    .filter((round) => round.status === "verified" || round.status === "pending_verification")
    .reduce((sum, round) => {
      const candidateVotes = (entries ?? [])
        .filter((entry) => entry.round_id === round.id)
        .reduce((inner, entry) => inner + entry.votes, 0);
      return sum + marksToBallots(candidateVotes + (round.invalid_votes ?? 0), post.seats);
    }, 0);
  const nextRound =
    rejected?.round_number ??
    Math.max(0, ...(rounds ?? []).map((round) => round.round_number), 0) + 1;

  const candidateList = (candidates ?? []) as Candidate[];
  const requireSupervisor = liveDisplaySettings(election).counting_requires_supervisor;
  const cumulative = cumulativeRoundScores(
    (rounds ?? []) as CountRound[],
    (entries ?? []) as CountEntry[],
    candidateList,
    post.seats ?? 1,
  );
  const latestCounted = (rounds ?? []).find(
    (round) => round.status === "verified" || round.status === "pending_verification",
  );
  const resultSnapshot = latestCounted ? cumulative.get(latestCounted.id) : undefined;

  return (
    <div className="flex min-h-0 flex-col gap-3 xl:h-[calc(100dvh-6.5rem)]">
      <div className="shrink-0">
        <Link href="/staff" className="text-xs text-primary hover:underline">
          Back to assigned posts
        </Link>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{post.name}</h1>
          <p className="text-xs text-muted-foreground">
            {election?.name} · {election?.count_limit} ballots per round
            {post.seats > 1 ? ` · ${post.seats} votes per ballot` : ""}
            {post.votes_polled ? ` · ${post.votes_polled} polled` : ""}
          </p>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
        <CountForm
          postId={postId}
          postName={post.name}
          roundNumber={nextRound}
          candidates={candidateList}
          pendingRound={pending as CountRound | null}
          rejectedRound={rejected as CountRound | null}
          countingOpen={election?.state === "counting"}
          requireSupervisor={requireSupervisor}
          roundSize={election?.count_limit ?? 1}
          votesPolled={post.votes_polled ?? 0}
          countedBallots={countedBallots}
          seats={post.seats}
          result={
            resultSnapshot
              ? {
                  entries: resultSnapshot.entries.map((entry) => ({
                    candidate_id: entry.candidate_id,
                    votes: entry.votes,
                    slot_votes: entry.slot_votes,
                  })),
                  invalid: resultSnapshot.invalid,
                  invalidSlots: resultSnapshot.invalidSlots,
                }
              : undefined
          }
        />
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card xl:max-h-none">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Earlier rounds</h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            {(rounds ?? []).length === 0 ? (
              <p className="px-1 py-6 text-sm text-muted-foreground">No rounds submitted yet.</p>
            ) : (
              (rounds ?? []).map((round) => {
                const snapshot = cumulative.get(round.id);
                return (
                  <RoundCard
                    key={round.id}
                    round={round as CountRound}
                    entries={snapshot?.entries ?? []}
                    invalidVotes={snapshot?.invalid}
                    invalidSlotVotes={snapshot?.invalidSlots}
                    seats={post.seats}
                  />
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
