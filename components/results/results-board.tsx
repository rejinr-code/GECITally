"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRealtimeResults } from "@/hooks/use-realtime-results";
import { PostSection } from "@/components/results/post-section";
import { LiveCounter } from "@/components/results/live-counter";
import { GeciMark } from "@/components/branding/geci-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatNumber, percent } from "@/lib/utils";
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

  return (
    <div
      className={cn(
        "flex h-dvh flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_#d1fae5,_#f8fafc_42%)]",
        bigScreen && "big-screen",
      )}
    >
      <header className="shrink-0 border-b border-emerald-900/10 bg-emerald-950 text-white">
        <div className="flex items-center gap-3 px-3 py-2 md:px-4">
          <GeciMark className="size-10 md:size-11" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="text-sm font-semibold leading-none">GECI Tally</p>
              <span className="hidden text-emerald-400 sm:inline">·</span>
              <p className="truncate text-sm text-emerald-100">{election.name}</p>
              <span className="hidden text-xs text-emerald-300 md:inline">
                {formatDate(election.date)}
              </span>
              <Badge className="h-5 capitalize">{election.state}</Badge>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-emerald-900">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[11px] tabular-nums text-emerald-200">{progress}%</span>
            </div>
          </div>
          <div className="hidden items-center gap-5 sm:flex">
            <Stat label="Polled" value={election.total_votes_polled} />
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

      <main className="flex min-h-0 flex-1 flex-col px-3 py-3 md:px-5 md:py-4">
        {current ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              className="flex min-h-0 flex-1 flex-col"
              initial={{ opacity: 0, x: 48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -48 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <PostSection
                post={current}
                votesPolled={election.total_votes_polled}
                countLimit={election.count_limit}
                flashKey={flashKey}
              />
            </motion.div>
          </AnimatePresence>
        ) : (
          <p className="m-auto text-muted-foreground">No posts configured yet.</p>
        )}
      </main>

      {posts.length > 0 && (
        <footer className="shrink-0 border-t border-emerald-900/10 bg-emerald-950 px-3 py-2 text-white md:px-4">
          <div
            key={cycle}
            className="mb-2 h-0.5 overflow-hidden rounded-full bg-emerald-900"
          >
            <div
              className="h-full bg-emerald-400"
              style={{ animation: `resultsRotate ${POST_ROTATE_MS}ms linear` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {posts.map((post, index) => (
              <button
                key={post.id}
                type="button"
                onClick={() => showPost(index)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs transition",
                  index === safeIndex
                    ? "bg-white text-emerald-950"
                    : "bg-emerald-900/80 text-emerald-100 hover:bg-emerald-800",
                )}
              >
                {post.name}
              </button>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-wide text-emerald-200">{label}</p>
      <LiveCounter value={value} className="text-lg font-semibold tabular-nums leading-none md:text-xl" />
      <p className="sr-only">{formatNumber(value)}</p>
    </div>
  );
}
