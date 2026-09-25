import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CountForm } from "@/components/counting/count-form";
import { RoundCard } from "@/components/counting/round-card";
import type { Candidate, CountEntry, CountRound } from "@/lib/types";
import { liveDisplaySettings } from "@/lib/utils";

function cumulativeRoundScores(
  rounds: CountRound[],
  entries: CountEntry[],
  candidates: Candidate[],
) {
  const running = new Map(candidates.map((candidate) => [candidate.id, 0]));
  let runningInvalid = 0;
  const snapshots = new Map<
    string,
    { entries: Array<CountEntry & { candidate_name: string }>; invalid: number }
  >();

  for (const round of [...rounds].sort((a, b) => a.round_number - b.round_number)) {
    const next = new Map(running);
    let nextInvalid = runningInvalid;
    for (const entry of entries.filter((item) => item.round_id === round.id)) {
      next.set(entry.candidate_id, (next.get(entry.candidate_id) ?? 0) + entry.votes);
    }
    nextInvalid += round.invalid_votes ?? 0;
    snapshots.set(round.id, {
      entries: candidates.map((candidate) => ({
        id: `${round.id}-${candidate.id}`,
        round_id: round.id,
        candidate_id: candidate.id,
        votes: next.get(candidate.id) ?? 0,
        candidate_name: candidate.name,
      })),
      invalid: nextInvalid,
    });
    if (round.status !== "rejected") {
      running.clear();
      next.forEach((votes, id) => running.set(id, votes));
      runningInvalid = nextInvalid;
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

  const { data: assignment } = await supabase
    .from("staff_assignments")
    .select("id")
    .eq("staff_id", user?.id ?? "")
    .eq("post_id", postId)
    .maybeSingle();

  if (!assignment) notFound();

  const { data: post } = await supabase.from("posts").select("*").eq("id", postId).single();
  if (!post) notFound();

  const { data: election } = await supabase
    .from("elections")
    .select("*")
    .eq("id", post.election_id)
    .maybeSingle();
  const { data: candidates } = await supabase
    .from("candidates")
    .select("*")
    .eq("post_id", postId)
    .order("display_order");
  const { data: rounds } = await supabase
    .from("count_rounds")
    .select("*")
    .eq("post_id", postId)
    .eq("staff_id", user?.id ?? "")
    .order("round_number", { ascending: false });

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
      return sum + candidateVotes + (round.invalid_votes ?? 0);
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
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/staff" className="text-sm text-primary hover:underline">
          Back to assigned posts
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{post.name}</h1>
        <p className="text-muted-foreground">
          {election?.name} · {election?.count_limit} ballots per round
          {post.votes_polled ? ` · ${post.votes_polled} polled` : ""}
        </p>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)]">
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
        />
        <aside className="flex min-h-[18rem] flex-col overflow-hidden rounded-xl border bg-card xl:sticky xl:top-4 xl:max-h-[calc(100vh-6rem)]">
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
