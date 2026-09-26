import { requireRole } from "@/lib/auth/require-role";
import { StaffPostLink } from "@/components/counting/staff-post-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createAdminClient } from "@/lib/supabase/admin";
import { countedBallotsFromRounds, liveDisplaySettings, percent } from "@/lib/utils";

type AssignedPost = { id: string; name: string; seats: number; votes_polled: number };
type RoundRow = { id: string; post_id: string; status: string; invalid_votes?: number | null };
type EntryRow = { round_id: string; votes: number };

export default async function StaffHomePage() {
  const { user } = await requireRole("staff");
  const admin = createAdminClient();

  const [{ data: election }, { data: assignments }] = await Promise.all([
    admin.from("elections").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("staff_assignments").select("post_id").eq("staff_id", user.id),
  ]);

  const postIds = (assignments ?? []).map((row) => row.post_id);
  const [{ data: posts }, { data: myRounds }, { data: postRounds }] = postIds.length
    ? await Promise.all([
        admin.from("posts").select("id, name, seats, votes_polled").in("id", postIds),
        admin
          .from("count_rounds")
          .select("id, post_id, status, invalid_votes")
          .in("post_id", postIds)
          .eq("staff_id", user.id),
        admin.from("count_rounds").select("id, post_id, status, invalid_votes").in("post_id", postIds),
      ])
    : [
        { data: [] as AssignedPost[] },
        { data: [] as RoundRow[] },
        { data: [] as RoundRow[] },
      ];

  const requireSupervisor = liveDisplaySettings(election).counting_requires_supervisor;
  const roundIds = [...new Set([...(myRounds ?? []), ...(postRounds ?? [])].map((round) => round.id))];
  const { data: entries } = roundIds.length
    ? await admin.from("count_entries").select("round_id, votes").in("round_id", roundIds)
    : { data: [] as EntryRow[] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Counting Supervisor</h1>
        <p className="mt-1 text-muted-foreground">
          {election ? `${election.name} · state: ${election.state}` : "No election configured."}
        </p>
      </div>
      {(posts ?? []).length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          You have not been assigned a post yet. Ask the election admin.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(posts ?? []).map((post) => {
            const postRoundsForStaff = (myRounds ?? []).filter((round) => round.post_id === post.id);
            const pending = postRoundsForStaff.find((round) => round.status === "pending_verification");
            const rejected = postRoundsForStaff.find((round) => round.status === "rejected");
            const counted = countedBallotsFromRounds(
              (postRounds ?? []).filter((round) => round.post_id === post.id),
              entries ?? [],
              post.seats,
            );
            const polled = post.votes_polled ?? 0;
            return (
              <StaffPostLink key={post.id} href={`/staff/${post.id}`}>
                <Card className="h-full transition hover:border-primary/40 hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      {post.name}
                      {requireSupervisor && pending && (
                        <Badge variant="warning">Awaiting Returning Officer verification</Badge>
                      )}
                      {rejected && !pending && <Badge variant="destructive">Rejected</Badge>}
                      {polled > 0 && counted >= polled && !pending && !rejected ? (
                        <Badge className="bg-emerald-700 text-white">Counting done</Badge>
                      ) : null}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {post.seats} seat{post.seats > 1 ? "s" : ""}
                      {post.seats > 1 ? ` · ${post.seats} votes per ballot` : ""} ·{" "}
                      {election?.count_limit ?? 0} ballots per round
                    </p>
                    <Progress value={polled > 0 ? percent(counted, polled) : 0} />
                    <p className="text-xs text-muted-foreground">
                      {polled > 0
                        ? `${counted}/${polled} ballots counted`
                        : `${counted} ballots counted`}
                    </p>
                  </CardContent>
                </Card>
              </StaffPostLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
