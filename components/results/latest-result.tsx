"use client";

import { useEffect, useRef, useState } from "react";
import { LiveCounter } from "@/components/results/live-counter";
import { candidateClassLabel } from "@/lib/candidate-class";
import { panelKey, panelTheme, postRaceStatus } from "@/lib/results-studio";
import type { LiveCandidate, LivePost } from "@/lib/types";
import { cn, initials, postIsDeclared } from "@/lib/utils";

function postCountSignature(post: LivePost) {
  const candidateVotes = (post.candidates ?? []).map((candidate) => `${candidate.id}:${candidate.votes}`).join(",");
  return `${post.verified_rounds}:${post.pending_rounds}:${post.total_verified_votes}:${post.invalid_votes}:${candidateVotes}`;
}

function postActivity(post: LivePost) {
  return (post.candidates ?? []).reduce((sum, candidate) => sum + candidate.votes, 0) + (post.invalid_votes ?? 0);
}

export function useLatestCountUpdate(posts: LivePost[]) {
  const prevRef = useRef(new Map<string, string>());
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    const signatures = new Map(posts.map((post) => [post.id, postCountSignature(post)]));
    const changed = posts.filter((post) => {
      const previous = prevRef.current.get(post.id);
      return previous !== undefined && previous !== signatures.get(post.id);
    });

    if (changed.length) {
      const newest = [...changed].sort((a, b) => postActivity(b) - postActivity(a) || a.name.localeCompare(b.name, "en"));
      setId(newest[0].id);
    } else if (!id) {
      const withCounts = posts.filter((post) => postActivity(post) > 0);
      const pick =
        withCounts.find((post) => !postIsDeclared(post)) ??
        withCounts[withCounts.length - 1] ??
        null;
      if (pick) setId(pick.id);
    } else if (!posts.some((post) => post.id === id)) {
      setId(null);
    }

    prevRef.current = signatures;
  }, [posts, id]);

  return posts.find((post) => post.id === id) ?? null;
}

export function LatestResult({ post }: { post: LivePost | null }) {
  if (!post) {
    return (
      <aside className="hidden w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:flex lg:w-80">
        <LatestHeader />
        <p className="flex flex-1 items-center justify-center px-4 py-6 text-center text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
          Awaiting first count
        </p>
      </aside>
    );
  }

  const race = postRaceStatus(post);
  const remainingSeats = Math.max(0, post.seats - race.elected.length);
  const headline = race.declared
    ? race.tied.length && !race.elected.length
      ? "TIE"
      : post.seats > 1
        ? "ELECTED"
        : "WINS"
    : race.hasVotes
      ? "LEADING"
      : "COUNTING";
  const rows = race.ranked.filter((candidate) => candidate.votes > 0 || race.declared);
  const leaderIds = new Set(race.elected.map((candidate) => candidate.id));
  const tiedIds = new Set(race.tied.map((candidate) => candidate.id));

  return (
    <aside className="hidden w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:flex lg:w-80">
      <LatestHeader />
      <div className="border-b border-slate-100 px-3 py-2">
        <p className="text-[9px] font-black tracking-[0.22em] text-slate-400">POST</p>
        <h2 className="mt-0.5 text-sm font-black uppercase leading-tight tracking-tight text-slate-950">
          {post.name}
        </h2>
        <span className="mt-1.5 inline-block rounded-sm bg-slate-900 px-1.5 py-0.5 text-[9px] font-black tracking-[0.16em] text-white">
          {headline}
        </span>
        {race.tied.length > 0 ? (
          <p className="mt-1 text-[9px] font-black tracking-[0.16em] text-slate-500">
            TIE FOR {remainingSeats || post.seats} SEAT{remainingSeats === 1 ? "" : "S"}
          </p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((person) => {
          const badge = leaderIds.has(person.id)
            ? race.declared
              ? "WON"
              : "LEAD"
            : tiedIds.has(person.id)
              ? "TIE"
              : "TRAIL";
          return <UpdateRow key={person.id} person={person} badge={badge} />;
        })}
      </div>
    </aside>
  );
}

function LatestHeader() {
  return (
    <div className="flex shrink-0 items-center gap-1.5 bg-red-600 px-3 py-1.5 text-white">
      <span className="size-1.5 shrink-0 rounded-full bg-white" style={{ animation: "livePulse 1.4s ease-out infinite" }} />
      <p className="text-[10px] font-black tracking-[0.22em]">LATEST UPDATE</p>
    </div>
  );
}

function UpdateRow({
  person,
  badge,
}: {
  person: LiveCandidate;
  badge: "WON" | "TIE" | "LEAD" | "TRAIL";
}) {
  const theme = panelTheme(person.panel_name, person.panel_color);
  const detail = [panelKey(person.panel_name), candidateClassLabel(person.branch, person.year, person.semester)]
    .filter(Boolean)
    .join(" · ");
  const emphasis = badge === "WON" || badge === "LEAD";

  return (
    <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0">
      {person.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.photo_url}
          alt=""
          className={cn("size-10 shrink-0 rounded-full object-cover ring-1", emphasis ? "ring-slate-900" : "ring-slate-300")}
        />
      ) : (
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-[10px] font-black ring-1 ring-slate-200"
          style={{ background: theme.bg, color: theme.fg }}
        >
          {initials(person.name)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black leading-tight text-slate-950">{person.name}</p>
        <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">{detail}</p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-sm px-1.5 py-0.5 text-[9px] font-black tracking-wide",
          badge === "WON" || badge === "LEAD"
            ? "bg-slate-900 text-white"
            : badge === "TIE"
              ? "border border-slate-300 text-slate-600"
              : "text-slate-400",
        )}
      >
        {badge}
      </span>
      <LiveCounter value={person.votes} className="w-7 shrink-0 text-right text-lg font-black tabular-nums text-slate-950" />
    </div>
  );
}
