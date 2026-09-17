"use client";

import { useState } from "react";
import { toast } from "sonner";
import { deleteCandidate, deletePost, saveCandidate, savePost } from "@/lib/actions/admin";
import type { Candidate, Panel, Post } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useAntiDuplicate } from "@/hooks/use-anti-duplicate";
import { formatNumber, initials, postSerial } from "@/lib/utils";

type PostWithCandidates = Post & { candidates: Candidate[] };

const selectClassName =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40";

export function PostEditor({
  electionId,
  posts,
  panels,
  countingStarted,
}: {
  electionId: string | null;
  posts: PostWithCandidates[];
  panels: Panel[];
  countingStarted: boolean;
}) {
  const { isSubmitting, run } = useAntiDuplicate();

  if (!electionId) {
    return <p className="text-sm text-muted-foreground">Save election metadata first.</p>;
  }

  return (
    <div className="space-y-6">
      <Card className="border-2 border-emerald-600 bg-gradient-to-br from-emerald-50 via-white to-amber-50 shadow-[0_18px_40px_-24px_rgba(4,120,87,0.85)] ring-4 ring-emerald-100">
        <CardHeader>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
            New post
          </p>
          <CardTitle className="mt-1 text-xl text-emerald-950">Add post</CardTitle>
          <p className="mt-1 text-sm text-emerald-800/80">
            Use this form to create another union post. Numbered posts already in the election are listed
            below.
          </p>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 md:grid-cols-[1.6fr_0.8fr_1fr_0.8fr_auto] md:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              void run(async () => {
                const result = await savePost(new FormData(form));
                if (result.error) toast.error(result.error);
                else {
                  toast.success("Post saved.");
                  form.reset();
                }
              });
            }}
          >
            <input type="hidden" name="election_id" value={electionId} />
            <div className="space-y-2">
              <Label htmlFor="post-name">Post name</Label>
              <Input id="post-name" name="name" placeholder="Chairperson" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seats">Seats</Label>
              <Input id="seats" name="seats" type="number" min={1} defaultValue={1} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="votes_polled">Votes polled</Label>
              <Input
                id="votes_polled"
                name="votes_polled"
                type="number"
                min={0}
                placeholder="0"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_order">Order</Label>
              <Input id="display_order" name="display_order" type="number" defaultValue={posts.length + 1} />
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : null}
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {posts.map((post, index) => (
        <PostCard
          key={post.id}
          number={postSerial(post, index)}
          post={post}
          panels={panels}
          countingStarted={countingStarted}
        />
      ))}
    </div>
  );
}

function PostCard({
  number,
  post,
  panels,
  countingStarted,
}: {
  number: number;
  post: PostWithCandidates;
  panels: Panel[];
  countingStarted: boolean;
}) {
  const { isSubmitting, run } = useAntiDuplicate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-800 text-sm font-semibold tabular-nums text-white">
            {number}
          </span>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {post.name}
            <Badge variant="secondary">
              {post.seats} seat{post.seats > 1 ? "s" : ""}
            </Badge>
            <Badge variant="outline">{formatNumber(post.votes_polled ?? 0)} polled</Badge>
          </CardTitle>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing((open) => !open)}>
            {editing ? "Close" : "Edit"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={countingStarted || busyId === post.id}
            onClick={() => {
              if (!window.confirm(`Delete ${post.name}?`)) return;
              setBusyId(post.id);
              void deletePost(post.id).then((result) => {
                setBusyId(null);
                if (result.error) toast.error(result.error);
                else toast.success("Post deleted.");
              });
            }}
          >
            Delete post
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <form
            className="grid gap-3 rounded-xl border bg-muted/30 p-3 md:grid-cols-[1.4fr_0.7fr_1fr_0.7fr_auto] md:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              void run(async () => {
                const result = await savePost(new FormData(form));
                if (result.error) toast.error(result.error);
                else {
                  toast.success("Post updated.");
                  setEditing(false);
                }
              });
            }}
          >
            <input type="hidden" name="id" value={post.id} />
            <input type="hidden" name="election_id" value={post.election_id} />
            <div className="space-y-2">
              <Label htmlFor={`name-${post.id}`}>Post name</Label>
              <Input id={`name-${post.id}`} name="name" defaultValue={post.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`seats-${post.id}`}>Seats</Label>
              <Input
                id={`seats-${post.id}`}
                name="seats"
                type="number"
                min={1}
                defaultValue={post.seats}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`votes-polled-${post.id}`}>Votes polled</Label>
              <Input
                id={`votes-polled-${post.id}`}
                name="votes_polled"
                type="number"
                min={0}
                defaultValue={post.votes_polled ?? 0}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`order-${post.id}`}>Order</Label>
              <Input
                id={`order-${post.id}`}
                name="display_order"
                type="number"
                defaultValue={post.display_order}
              />
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : null}
              Save
            </Button>
          </form>
        ) : (
          <form
            className="grid gap-3 rounded-xl border bg-muted/30 p-3 md:grid-cols-[1fr_auto] md:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              void run(async () => {
                const result = await savePost(new FormData(form));
                if (result.error) toast.error(result.error);
                else toast.success("Post updated.");
              });
            }}
          >
            <input type="hidden" name="id" value={post.id} />
            <input type="hidden" name="election_id" value={post.election_id} />
            <input type="hidden" name="name" value={post.name} />
            <input type="hidden" name="seats" value={post.seats} />
            <input type="hidden" name="display_order" value={post.display_order} />
            <div className="space-y-2">
              <Label htmlFor={`votes-polled-quick-${post.id}`}>Votes polled for this post</Label>
              <Input
                id={`votes-polled-quick-${post.id}`}
                name="votes_polled"
                type="number"
                min={0}
                defaultValue={post.votes_polled ?? 0}
                required
              />
            </div>
            <Button type="submit" variant="outline" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : null}
              Save polled
            </Button>
          </form>
        )}
        <ul className="space-y-2 text-sm">
          {post.candidates.map((candidate) => (
            <CandidateRow
              key={candidate.id}
              candidate={candidate}
              panels={panels}
              countingStarted={countingStarted}
            />
          ))}
        </ul>
        <form
          className="grid gap-3 md:grid-cols-[1.4fr_1fr_1.4fr_auto] md:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            void run(async () => {
              const result = await saveCandidate(new FormData(form));
              if (result.error) toast.error(result.error);
              else {
                toast.success("Candidate added.");
                form.reset();
              }
            });
          }}
        >
          <input type="hidden" name="post_id" value={post.id} />
          <input type="hidden" name="display_order" value={post.candidates.length + 1} />
          <div className="space-y-2">
            <Label>Candidate</Label>
            <Input name="name" placeholder="Full name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`panel-${post.id}`}>Panel</Label>
            <select id={`panel-${post.id}`} name="panel_id" defaultValue="" className={selectClassName}>
              <option value="">Independent</option>
              {panels.map((panel) => (
                <option key={panel.id} value={panel.id}>
                  {panel.name}
                </option>
              ))}
            </select>
            {!panels.length && (
              <p className="text-xs text-muted-foreground">Add panels above to assign one here.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`photo-${post.id}`}>Photo</Label>
            <PhotoField id={`photo-${post.id}`} />
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Spinner /> : null}
            Add
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CandidateRow({
  candidate,
  panels,
  countingStarted,
}: {
  candidate: Candidate;
  panels: Panel[];
  countingStarted: boolean;
}) {
  const { isSubmitting, run } = useAntiDuplicate();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="rounded-lg border bg-white px-3 py-3">
        <form
          className="grid gap-3 md:grid-cols-[1.4fr_1fr_1.4fr_auto] md:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            void run(async () => {
              const result = await saveCandidate(new FormData(form));
              if (result.error) toast.error(result.error);
              else {
                toast.success("Candidate updated.");
                setEditing(false);
              }
            });
          }}
        >
          <input type="hidden" name="id" value={candidate.id} />
          <input type="hidden" name="post_id" value={candidate.post_id} />
          <input type="hidden" name="display_order" value={candidate.display_order} />
          <div className="space-y-2">
            <Label htmlFor={`cand-name-${candidate.id}`}>Candidate</Label>
            <Input id={`cand-name-${candidate.id}`} name="name" defaultValue={candidate.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`cand-panel-${candidate.id}`}>Panel</Label>
            <select
              id={`cand-panel-${candidate.id}`}
              name="panel_id"
              defaultValue={candidate.panel_id ?? ""}
              className={selectClassName}
            >
              <option value="">Independent</option>
              {panels.map((panel) => (
                <option key={panel.id} value={panel.id}>
                  {panel.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`cand-photo-${candidate.id}`}>Photo</Label>
            <PhotoField id={`cand-photo-${candidate.id}`} currentUrl={candidate.photo_url} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : null}
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        {candidate.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={candidate.photo_url}
            alt=""
            className="size-9 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-9 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">
            {initials(candidate.name)}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-medium">{candidate.name}</p>
          <p className="text-xs text-muted-foreground">{candidate.panel_name || "Independent"}</p>
        </div>
      </div>
      <div className="flex gap-1">
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={countingStarted}
          onClick={() => {
            void deleteCandidate(candidate.id).then((result) => {
              if (result.error) toast.error(result.error);
              else toast.success("Candidate removed.");
            });
          }}
        >
          Remove
        </Button>
      </div>
    </li>
  );
}

function PhotoField({
  id,
  currentUrl,
}: {
  id: string;
  currentUrl?: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {(preview || currentUrl) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview || currentUrl || ""}
          alt=""
          className="size-14 rounded-full object-cover ring-1 ring-emerald-900/10"
        />
      )}
      <Input
        id={id}
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="pt-1.5 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-2 file:py-1 file:text-xs file:font-medium file:text-emerald-800"
        onChange={(event) => {
          const file = event.target.files?.[0];
          setPreview(file ? URL.createObjectURL(file) : null);
        }}
      />
      {currentUrl && !preview && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" name="remove_photo" value="1" className="size-3.5" />
          Remove current photo
        </label>
      )}
    </div>
  );
}
