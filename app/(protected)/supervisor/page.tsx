import { createClient } from "@/lib/supabase/server";
import { VerificationCard } from "@/components/supervisor/verification-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Candidate, CountEntry, CountRound, PendingRound, Post, Profile } from "@/lib/types";
import { liveDisplaySettings, percent } from "@/lib/utils";

export default async function SupervisorPage() {
  const supabase = await createClient();

  const { data: election } = await supabase
    .from("elections")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: posts } = election
    ? await supabase.from("posts").select("*").eq("election_id", election.id).order("display_order")
    : { data: [] as Post[] };

  const { data: pendingRounds } = await supabase
    .from("count_rounds")
    .select("*")
    .eq("status", "pending_verification")
    .order("submitted_at", { ascending: true });

  const postIds = (posts ?? []).map((post) => post.id);
  const { data: verified } = postIds.length
    ? await supabase.from("count_rounds").select("id, post_id, status").in("post_id", postIds).eq("status", "verified")
    : { data: [] };

  const verifiedRoundIds = (verified ?? []).map((round) => round.id);
  const { data: verifiedEntries } = verifiedRoundIds.length
    ? await supabase.from("count_entries").select("round_id, votes").in("round_id", verifiedRoundIds)
    : { data: [] as Array<{ round_id: string; votes: number }> };

  const staffIds = [...new Set((pendingRounds ?? []).map((round) => round.staff_id))];
  const roundIds = (pendingRounds ?? []).map((round) => round.id);

  const { data: staffProfiles } = staffIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", staffIds)
    : { data: [] as Pick<Profile, "id" | "full_name">[] };

  const { data: entries } = roundIds.length
    ? await supabase.from("count_entries").select("*").in("round_id", roundIds)
    : { data: [] as CountEntry[] };

  const candidateIds = [...new Set((entries ?? []).map((entry) => entry.candidate_id))];
  const { data: candidates } = candidateIds.length
    ? await supabase.from("candidates").select("id, name, panel_name, branch, year").in("id", candidateIds)
    : { data: [] as Pick<Candidate, "id" | "name" | "panel_name" | "branch" | "year">[] };

  const postMap = new Map((posts ?? []).map((post) => [post.id, post]));
  const staffMap = new Map((staffProfiles ?? []).map((person) => [person.id, person]));
  const candidateMap = new Map((candidates ?? []).map((candidate) => [candidate.id, candidate]));

  const requireSupervisor = liveDisplaySettings(election).counting_require_verification;

  const queue: PendingRound[] = ((pendingRounds ?? []) as CountRound[]).flatMap((round) => {
    const post = postMap.get(round.post_id);
    const staff = staffMap.get(round.staff_id);
    if (!post || !staff) return [];
    return [
      {
        ...round,
        post: { id: post.id, name: post.name, seats: post.seats },
        staff: { id: staff.id, full_name: staff.full_name },
        entries: ((entries ?? []) as CountEntry[])
          .filter((entry) => entry.round_id === round.id)
          .flatMap((entry) => {
            const candidate = candidateMap.get(entry.candidate_id);
            if (!candidate) return [];
            return [{ ...entry, candidate }];
          }),
      },
    ];
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Supervisor verification</h1>
        <p className="mt-1 text-muted-foreground">
          {election ? `${election.name} · ${election.count_limit} ballots per round` : "No election configured."}
        </p>
        {election && !requireSupervisor ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Counting is set to proceed without supervisor approval. New rounds are accepted on submit.
            Any rounds already in this queue still need a decision.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(posts ?? []).map((post) => {
          const postRoundIds = new Set(
            (verified ?? []).filter((round) => round.post_id === post.id).map((round) => round.id),
          );
          const counted = (verifiedEntries ?? [])
            .filter((entry) => postRoundIds.has(entry.round_id))
            .reduce((sum, entry) => sum + entry.votes, 0);
          const polled = post.votes_polled ?? 0;
          return (
            <Card key={post.id}>
              <CardHeader>
                <CardTitle className="text-base">{post.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={polled > 0 ? percent(counted, polled) : 0} />
                <p className="mt-2 text-sm text-muted-foreground">
                  {polled > 0 ? `${counted}/${polled} ballots counted` : `${counted} ballots counted`}
                  {polled > 0 && counted >= polled ? " · finalised" : ""}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Pending queue</h2>
        {queue.length === 0 ? (
          <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            No rounds waiting for verification.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {queue.map((round) => (
              <VerificationCard key={round.id} round={round} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
