"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRealtimeResults } from "@/hooks/use-realtime-results";
import { PostSection } from "@/components/results/post-section";
import { LiveCounter } from "@/components/results/live-counter";
import { GeciMark } from "@/components/branding/geci-mark";
import { MulearnCredit } from "@/components/branding/mulearn-credit";
import { Button } from "@/components/ui/button";
import { formatDate, formatNumber, percent, shortPostName } from "@/lib/utils";
import { cn } from "@/lib/utils";

const BIG_SCREEN_KEY = "geci-big-screen";
const POST_ROTATE_MS = 12000;
const bigScreenListeners = new Set<() => void>();

function emitBigScreen() {
  bigScreenListeners.forEach((listener) => listener());
}

function subscribeBigScreen(listener: () => void) {
  bigScreenListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    bigScreenListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getBigScreenSnapshot() {
  return window.localStorage.getItem(BIG_SCREEN_KEY) === "1";
}

function getBigScreenServerSnapshot() {
  return false;
}

function setBigScreenMode(value: boolean) {
  window.localStorage.setItem(BIG_SCREEN_KEY, value ? "1" : "0");
  document.documentElement.classList.toggle("big-screen", value);
  emitBigScreen();
}

export function ResultsBoard() {
  const { data, error, loading, flashKey } = useRealtimeResults();
  const bigScreen = useSyncExternalStore(
    subscribeBigScreen,
    getBigScreenSnapshot,
    getBigScreenServerSnapshot,
  );
  const [postIndex, setPostIndex] = useState(0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    document.documentElement.classList.toggle("big-screen", bigScreen);
  }, [bigScreen]);

  const election = data?.election ?? null;
  const posts = useMemo(() => data?.posts ?? [], [data?.posts]);
  const safeIndex = posts.length ? postIndex % posts.length : 0;
  const current = posts[safeIndex];
  const progress = useMemo(() => {
    if (!election || !posts.length) return 0;
    const verified = posts.reduce(
      (sum, post) => sum + Math.min(post.verified_rounds, election.count_limit),
      0,
    );
    return percent(verified, posts.length * election.count_limit);
  }, [election, posts]);
  const totalVotes = posts.reduce((sum, post) => sum + post.total_verified_votes, 0);
  const declaredCount = posts.filter(
    (post) => post.is_finalised || election?.state === "finalised",
  ).length;

  useEffect(() => {
    if (posts.length <= 1) return;
    const timer = window.setInterval(() => {
      setPostIndex((index) => (index + 1) % posts.length);
      setCycle((value) => value + 1);
    }, POST_ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [posts.length, cycle]);

  function showPost(index: number) {
    setPostIndex(index);
    setCycle((value) => value + 1);
  }

  if (loading) {
    return <p className="py-24 text-center text-muted-foreground">Loading live results…</p>;
  }

  if (error) {
    return (
      <p className="mx-auto max-w-xl rounded-xl bg-red-50 p-6 text-center text-red-800">
        {error}. Confirm the Supabase URL/keys and that the schema migration has been applied.
      </p>
    );
  }

  if (!election) {
    return (
      <p className="py-24 text-center text-muted-foreground">
        No election has been configured yet.
      </p>
    );
  }

  const live = election.state === "counting";

  return (
    <div
      className={cn(
        "flex h-dvh flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,_#0f766e_0%,_#042f2e_38%,_#022c22_100%)] text-white",
        bigScreen && "big-screen",
      )}
    >
      <header className="shrink-0 border-b border-white/10 bg-black/30">
        <div className="flex items-center gap-3 px-3 py-2 md:px-4">
          <GeciMark className="size-10 md:size-11" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-[10px] font-black tracking-[0.22em]",
                  live ? "bg-red-600 text-white" : "bg-amber-300 text-emerald-950",
                )}
              >
                {live ? (
                  <span
                    className="size-1.5 rounded-full bg-white"
                    style={{ animation: "livePulse 1.4s ease-out infinite" }}
                  />
                ) : null}
                {live ? "LIVE" : "FINAL"}
              </span>
              <p className="text-sm font-semibold leading-none">GECI Tally</p>
              <span className="hidden text-emerald-400 sm:inline">·</span>
              <p className="truncate text-sm text-emerald-50">{election.name}</p>
              <span className="hidden text-xs text-emerald-200 md:inline">
                {formatDate(election.date)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/40">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[11px] tabular-nums text-emerald-100">
                {progress}% · {declaredCount}/{posts.length} declared
              </span>
            </div>
          </div>
          <div className="hidden items-center gap-5 sm:flex">
            <Stat label="Polled" value={current?.votes_polled ?? election.total_votes_polled} />
            <Stat label="Verified" value={totalVotes} />
          </div>
          <Button
            type="button"
            size="sm"
            variant={bigScreen ? "secondary" : "outline"}
            className={cn("shrink-0", !bigScreen && "border-white/30 bg-transparent text-white hover:bg-white/10")}
            onClick={() => setBigScreenMode(!bigScreen)}
          >
            {bigScreen ? "Exit hall" : "Hall view"}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {posts.length > 0 ? (
          <nav className="flex w-[11.5rem] shrink-0 flex-col border-r border-white/10 bg-black/25 md:w-60">
            <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
              Posts
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              {posts.map((post, index) => {
                const won =
                  (post.is_finalised || election.state === "finalised") &&
                  post.candidates.some((candidate) => candidate.votes > 0);
                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => showPost(index)}
                    className={cn(
                      "mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition",
                      index === safeIndex
                        ? "bg-amber-300 text-emerald-950 shadow-[0_0_0_1px_rgba(251,191,36,0.6)]"
                        : "text-emerald-50 hover:bg-white/10",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded text-[11px] font-black tabular-nums",
                        index === safeIndex ? "bg-emerald-950 text-amber-300" : "bg-white/10",
                      )}
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium leading-tight">
                      {shortPostName(post.name)}
                    </span>
                    {won ? (
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          index === safeIndex ? "bg-emerald-800" : "bg-amber-300",
                        )}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </nav>
        ) : null}

        <main className="flex min-h-0 min-w-0 flex-1 flex-col p-2 md:p-3">
          {current ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                className="flex min-h-0 flex-1 flex-col"
                initial={{ opacity: 0, x: 36 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -36 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <PostSection
                  post={{
                    ...current,
                    votes_polled: current.votes_polled ?? election.total_votes_polled,
                  }}
                  countLimit={election.count_limit}
                  flashKey={flashKey}
                  electionState={election.state}
                  serial={safeIndex + 1}
                />
              </motion.div>
            </AnimatePresence>
          ) : (
            <p className="m-auto text-emerald-100">No posts configured yet.</p>
          )}
        </main>
      </div>

      <footer className="flex h-9 shrink-0 items-center gap-3 overflow-hidden border-t border-amber-300/20 bg-black/50 px-3">
        {posts.length > 0 ? (
          <div key={cycle} className="h-0.5 w-16 shrink-0 overflow-hidden rounded-full bg-emerald-900/80">
            <div
              className="h-full bg-amber-300"
              style={{ animation: `resultsRotate ${POST_ROTATE_MS}ms linear` }}
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1 overflow-hidden [&_img]:h-5 [&_>div]:max-w-full [&_>div]:gap-2 [&_>div]:px-2 [&_>div]:py-0">
          <MulearnCredit light compact />
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-200">{label}</p>
      <LiveCounter value={value} className="text-lg font-semibold tabular-nums leading-none md:text-xl" />
      <p className="sr-only">{formatNumber(value)}</p>
    </div>
  );
}
