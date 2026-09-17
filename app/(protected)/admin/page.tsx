import { createClient } from "@/lib/supabase/server";
import { ElectionSettings } from "@/components/admin/election-settings";
import { PanelManager } from "@/components/admin/panel-manager";
import { PostEditor } from "@/components/admin/post-editor";
import { StaffManager } from "@/components/admin/staff-manager";
import type { Candidate, Election, Panel, Post, Profile } from "@/lib/types";

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: election } = await supabase
    .from("elections")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: posts } = election
    ? await supabase
        .from("posts")
        .select("*")
        .eq("election_id", election.id)
        .order("display_order")
    : { data: [] as Post[] };

  const postIds = (posts ?? []).map((post) => post.id);
  const { data: candidates } = postIds.length
    ? await supabase.from("candidates").select("*").in("post_id", postIds).order("display_order")
    : { data: [] as Candidate[] };

  const { data: people } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name");

  const { data: assignments } = await supabase.from("staff_assignments").select("*");

  let panels: Panel[] = [];
  let schemaNeedsUpdate = false;
  if (election) {
    const { data, error } = await supabase
      .from("panels")
      .select("*")
      .eq("election_id", election.id)
      .order("display_order");
    if (error) schemaNeedsUpdate = true;
    else panels = (data ?? []) as Panel[];
  }

  const postsWithCandidates = (posts ?? []).map((post) => ({
    ...post,
    candidates: (candidates ?? []).filter((candidate) => candidate.post_id === post.id),
  }));

  const peopleWithAssignments = ((people ?? []) as Profile[]).map((person) => ({
    ...person,
    assigned_post_ids: (assignments ?? [])
      .filter((assignment) => assignment.staff_id === person.id)
      .map((assignment) => assignment.post_id),
  }));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin configuration</h1>
        <p className="mt-1 text-muted-foreground">
          Set up the election, panels, posts, candidates, and counting duty before opening the count.
        </p>
        {schemaNeedsUpdate && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Run <code className="font-medium">supabase/migrations/0002_panels_and_post_votes.sql</code> in
            the Supabase SQL editor to enable panels and per-post votes polled.
          </p>
        )}
      </div>
      <ElectionSettings election={(election as Election | null) ?? null} />
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Panels</h2>
        <PanelManager electionId={election?.id ?? null} panels={panels} />
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Posts and candidates</h2>
        <PostEditor
          electionId={election?.id ?? null}
          posts={postsWithCandidates}
          panels={panels}
          countingStarted={election?.state !== "setup"}
        />
      </section>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">People</h2>
        <StaffManager posts={(posts ?? []) as Post[]} people={peopleWithAssignments} />
      </section>
    </div>
  );
}
