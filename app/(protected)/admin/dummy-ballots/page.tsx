import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { DummyBallotStudio } from "@/components/admin/dummy-ballot-studio";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Candidate, Election, Panel, Post } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DummyBallotsPage() {
  await requireRole("admin");
  const admin = createAdminClient();

  const { data: election } = await admin
    .from("elections")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!election) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Dummy ballots</h1>
        <p className="text-muted-foreground">Save election metadata first.</p>
        <Button asChild variant="outline">
          <Link href="/admin">Back</Link>
        </Button>
      </div>
    );
  }

  const [{ data: posts }, { data: panels }] = await Promise.all([
    admin.from("posts").select("*").eq("election_id", election.id).order("display_order"),
    admin.from("panels").select("*").eq("election_id", election.id).order("display_order"),
  ]);
  const postIds = (posts ?? []).map((post) => post.id);
  const { data: candidates } = postIds.length
    ? await admin.from("candidates").select("*").in("post_id", postIds).order("display_order")
    : { data: [] as Candidate[] };

  const postsWithCandidates = ((posts ?? []) as Post[]).map((post) => ({
    ...post,
    candidates: ((candidates ?? []) as Candidate[]).filter((candidate) => candidate.post_id === post.id),
  }));

  return (
    <DummyBallotStudio
      electionId={election.id}
      electionName={(election as Election).name}
      posts={postsWithCandidates}
      panels={(panels ?? []) as Panel[]}
    />
  );
}
