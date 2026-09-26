"use client";

import { useEffect, useRef, useState } from "react";
import { LiveCounter } from "@/components/results/live-counter";
import { candidateClassLabel } from "@/lib/candidate-class";
import { panelKey, panelTheme, postRaceStatus } from "@/lib/results-studio";
import type { LiveCandidate, LivePost } from "@/lib/types";
import { cn, initials, postIsDeclared } from "@/lib/utils";

export function useLatestDeclaredPost(posts: LivePost[]) {
  const seenRef = useRef(new Set<string>());
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    const declared = posts.filter((post) => postIsDeclared(post));
    if (!declared.length) {
      seenRef.current.clear();
      setId(null);
      return;
    }

    const unseen = declared.filter((post) => !seenRef.current.has(post.id));
    if (unseen.length) {
      setId(unseen[unseen.length - 1].id);
      for (const post of unseen) seenRef.current.add(post.id);
      return;
    }

    if (id && !declared.some((post) => post.id === id)) {
      setId(declared[declared.length - 1].id);
    }
  }, [posts, id]);

  return posts.find((post) => post.id === id) ?? null;
}

export function LatestResult({ post }: { post: LivePost | null }) {
  if (!post) {
    return (
      <aside className="hidden w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:flex lg:w-80">
        <LatestHeader empty />
        <p className="flex flex-1 items-center justify-center px-4 py-6 text-center text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
          Awaiting first declared result
        </p>
      </aside>
    );
  }

  const race = postRaceStatus(post);
  const winners = race.elected;
  const tied = race.tied;
  const headline = tied.length && !winners.length ? "TIE" : post.seats > 1 ? "ELECTED" : "WINS";
  const remainingSeats = Math.max(0, post.seats - winners.length);

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
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {winners.map((winner) => (
          <DeclaredRow key={winner.id} person={winner} badge="WON" />
        ))}
        {tied.length > 0 ? (
          <>
            <p className="px-3 py-1.5 text-[9px] font-black tracking-[0.18em] text-slate-500">
              TIE FOR {remainingSeats || post.seats} SEAT{remainingSeats === 1 ? "" : "S"}
            </p>
            {tied.map((person) => (
              <DeclaredRow key={person.id} person={person} badge="TIE" />
            ))}
          </>
        ) : null}
      </div>
    </aside>
  );
}

function LatestHeader({ empty = false }: { empty?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 bg-red-600 px-3 py-1.5 text-white">
      <span className="size-1.5 shrink-0 rounded-full bg-white" style={{ animation: "livePulse 1.4s ease-out infinite" }} />
      <p className="text-[10px] font-black tracking-[0.22em]">{empty ? "LATEST RESULT" : "JUST DECLARED"}</p>
    </div>
  );
}

function DeclaredRow({ person, badge }: { person: LiveCandidate; badge: "WON" | "TIE" }) {
  const theme = panelTheme(person.panel_name, person.panel_color);
  const detail = [panelKey(person.panel_name), candidateClassLabel(person.branch, person.year, person.semester)]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0">
      {person.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.photo_url}
          alt=""
          className={cn(
            "size-10 shrink-0 rounded-full object-cover ring-1",
            badge === "WON" ? "ring-slate-900" : "ring-slate-300",
          )}
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
          badge === "WON" ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-600",
        )}
      >
        {badge}
      </span>
      <LiveCounter value={person.votes} className="w-7 shrink-0 text-right text-lg font-black tabular-nums text-slate-950" />
    </div>
  );
}
