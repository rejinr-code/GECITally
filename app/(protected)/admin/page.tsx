import { createAdminClient } from "@/lib/supabase/admin";
import { AdminConsole } from "@/components/admin/admin-console";
import { requireRole } from "@/lib/auth/require-role";
import type { Candidate, Election, Panel, Post, Profile } from "@/lib/types";
import { liveDisplaySettings } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireRole("admin");
  const admin = createAdminClient();

  const { data: election } = await admin
    .from("elections")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const electionId = election?.id ?? null;

  const [postsResult, peopleResult, assignmentsResult, panelsResult] = await Promise.all([
    electionId
      ? admin.from("posts").select("*").eq("election_id", electionId).order("display_order")
      : Promise.resolve({ data: [] as Post[], error: null }),
    admin.from("profiles").select("*").order("full_name"),
    admin.from("staff_assignments").select("staff_id, post_id"),
    electionId
      ? admin.from("panels").select("*").eq("election_id", electionId).order("display_order")
      : Promise.resolve({ data: [] as Panel[], error: null }),
  ]);

  const posts = (postsResult.data ?? []) as Post[];
  const postIds = posts.map((post) => post.id);
  const { data: candidates } = postIds.length
    ? await admin.from("candidates").select("*").in("post_id", postIds).order("display_order")
    : { data: [] as Candidate[] };

  const { error: candidateClassError } = await admin.from("candidates").select("branch, year").limit(1);
  const { error: liveDisplayError } = await admin
    .from("elections")
    .select("results_rotate_seconds, results_require_verification")
    .limit(1);
  const { error: countingModeError } = await admin
    .from("elections")
    .select("counting_require_verification")
    .limit(1);
  const { error: panelColorError } = await admin.from("panels").select("color").limit(1);

  const schemaNeedsUpdate = Boolean(panelsResult.error);
  const schemaNeedsCandidateClass = Boolean(candidateClassError);
  const schemaNeedsLiveDisplay = Boolean(liveDisplayError);
  const schemaNeedsCountingMode = Boolean(countingModeError);
  const schemaNeedsPanelColor = Boolean(panelColorError);
  const panels = schemaNeedsUpdate ? [] : ((panelsResult.data ?? []) as Panel[]);

  const postsWithCandidates = posts.map((post) => ({
    ...post,
    votes_polled: post.votes_polled ?? 0,
    candidates: ((candidates ?? []) as Candidate[]).filter((candidate) => candidate.post_id === post.id),
  }));

  const peopleWithAssignments = ((peopleResult.data ?? []) as Profile[]).map((person) => ({
    ...person,
    assigned_post_ids: (assignmentsResult.data ?? [])
      .filter((assignment) => assignment.staff_id === person.id)
      .map((assignment) => assignment.post_id),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin configuration</h1>
        <p className="mt-1 text-muted-foreground">
          Set up the election, panels, posts, candidates, and counting duty before opening the count.
        </p>
      </div>
      <AdminConsole
        election={
          election
            ? ({
                ...election,
                ...liveDisplaySettings(election as Election),
              } as Election)
            : null
        }
        electionId={electionId}
        panels={panels}
        posts={postsWithCandidates}
        people={peopleWithAssignments}
        countingStarted={election?.state !== "setup"}
        schemaNeedsUpdate={schemaNeedsUpdate}
        schemaNeedsCandidateClass={schemaNeedsCandidateClass}
        schemaNeedsLiveDisplay={schemaNeedsLiveDisplay}
        schemaNeedsCountingMode={schemaNeedsCountingMode}
        schemaNeedsPanelColor={schemaNeedsPanelColor}
      />
    </div>
  );
}
