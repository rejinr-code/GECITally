"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRealtimeResults } from "@/hooks/use-realtime-results";
import { PostSection } from "@/components/results/post-section";
import { LatestResult, LATEST_REVEAL_MS, useLatestCountUpdate } from "@/components/results/latest-result";
import { LiveCounter } from "@/components/results/live-counter";
import { GeciMark } from "@/components/branding/geci-mark";
import { MulearnCredit } from "@/components/branding/mulearn-credit";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Button } from "@/components/ui/button";
import {
  formatDate,
  formatNumber,
  initials,
  liveDisplaySettings,
  percent,
} from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  panelTheme,
  raceTickerItems,
  summarizePanels,
  summarizeSeatRace,
  type PanelStanding,
  type TickerItem,
} from "@/lib/results-studio";

const BIG_SCREEN_KEY = "geci-big-screen";
const DEFAULT_ROTATE_MS = 12000;
const bigScreenListeners = new Set<() => void>();

function emitBigScreen() {
  bigScreenListeners.forEach((listener) => listener());
}

function setBigScreenMode(value: boolean) {
  window.localStorage.setItem(BIG_SCREEN_KEY, value ? "1" : "0");
  document.documentElement.classList.toggle("big-screen", value);
  emitBigScreen();
}

function useBigScreen() {
  const [bigScreen, setBigScreen] = useState(false);
  useEffect(() => {
    const sync = () => {
      const value = window.localStorage.getItem(BIG_SCREEN_KEY) === "1";
      setBigScreen(value);
      document.documentElement.classList.toggle("big-screen", value);
    };
    sync();
    const listener = () => sync();
    bigScreenListeners.add(listener);
    window.addEventListener("storage", listener);
    return () => {
      bigScreenListeners.delete(listener);
      window.removeEventListener("storage", listener);
    };
  }, []);
  return bigScreen;
}

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!now) return "--:--:--";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
    .format(now)
    .replace(/\s/g, " ")
    .toUpperCase();
}

function StudioMessage({ children }: { children: ReactNode }) {
  return (
    <div className="studio-shell flex h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-800">{children}</p>
    </div>
  );
}

export function ResultsBoard({
  signOutHref = "/results/login",
  homeHref = "/",
}: {
  signOutHref?: string;
  homeHref?: string;
}) {
  const { data, error, loading, flashKey } = useRealtimeResults();
  const bigScreen = useBigScreen();
  const clock = useClock();
  const [ready, setReady] = useState(false);
  const [postIndex, setPostIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [revealHold, setRevealHold] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const election = data?.election ?? null;
  const posts = useMemo(() => data?.posts ?? [], [data?.posts]);
  const safeIndex = posts.length ? postIndex % posts.length : 0;
  const current = posts[safeIndex];
  const seatRace = useMemo(() => summarizeSeatRace(posts), [posts]);
  const postProgress = percent(seatRace.declaredPosts, seatRace.postCount);
  const panels = useMemo(() => summarizePanels(posts), [posts]);
  const ticker = useMemo(() => raceTickerItems(posts), [posts]);
  const { post: latestUpdate, holdOrder } = useLatestCountUpdate(posts);
  const display = liveDisplaySettings(election);
  const rotateMs = display.results_rotate_seconds * 1000;
  const latestKey = latestUpdate
    ? `${latestUpdate.id}:${latestUpdate.verified_rounds}:${latestUpdate.pending_rounds}:${latestUpdate.total_verified_votes}:${latestUpdate.invalid_votes}`
    : "";

  useEffect(() => {
    if (!latestKey) {
      setRevealHold(false);
      return;
    }
    setRevealHold(true);
    const timer = window.setTimeout(() => setRevealHold(false), LATEST_REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [latestKey]);

  useEffect(() => {
    if (posts.length <= 1 || revealHold) return;
    const timer = window.setInterval(() => {
      setPostIndex((index) => (index + 1) % posts.length);
      setCycle((value) => value + 1);
    }, rotateMs);
    return () => window.clearInterval(timer);
  }, [posts.length, cycle, rotateMs, revealHold]);

  if (!ready || loading) {
    return (
      <StudioMessage>
        Loading live results…{" "}
        <Link href={homeHref} className="text-emerald-700 hover:underline">
          Home
        </Link>
      </StudioMessage>
    );
  }

  if (error && !election) {
    return (
      <StudioMessage>
        {error}. Confirm the Supabase URL/keys and that the schema migration has been applied.{" "}
        <Link href={homeHref} className="text-emerald-700 hover:underline">
          Home
        </Link>
      </StudioMessage>
    );
  }

  if (!election) {
    return (
      <StudioMessage>
        No election has been configured yet.{" "}
        <Link href={homeHref} className="text-emerald-700 hover:underline">
          Home
        </Link>
      </StudioMessage>
    );
  }

  const live = election.state === "counting";

  return (
    <div className={cn("studio-shell relative flex h-dvh flex-col overflow-hidden text-slate-950", bigScreen && "big-screen")}>
      <div className="studio-scan absolute inset-0 z-0" />
      <header className="relative z-10 shrink-0">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white/90 px-3 py-2 md:px-4">
          <Link href={homeHref} className="shrink-0 rounded-md bg-white p-1 ring-1 ring-slate-200">
            <GeciMark className="size-9 md:size-10" />
            <span className="sr-only">Home</span>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-black tracking-[0.22em]",
                  live ? "bg-red-600 text-white" : "bg-amber-300 text-slate-950",
                )}
              >
                {live ? (
                  <span className="size-1.5 rounded-full bg-white" style={{ animation: "livePulse 1.4s ease-out infinite" }} />
                ) : null}
                {live ? "LIVE" : "FINAL"}
              </span>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">GECI Tally</p>
              <p className="truncate text-sm font-semibold text-slate-900">{election.name}</p>
              <span className="hidden text-xs text-slate-500 md:inline">{formatDate(election.date)}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-slate-500" style={{ width: `${postProgress}%` }} />
              </div>
              <span className="text-[11px] font-bold tabular-nums text-slate-600">
                {seatRace.declaredPosts} of {seatRace.postCount} posts decided
              </span>
            </div>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Posts</p>
            <p className="text-2xl font-black tabular-nums leading-none text-slate-950">
              {seatRace.declaredPosts}/{seatRace.postCount}
            </p>
          </div>
          <div className="hidden text-right md:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Clock</p>
            <p className="text-lg font-black tabular-nums leading-none text-emerald-700">{clock}</p>
          </div>
          {!bigScreen ? (
            <div className="flex shrink-0 items-center gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link href={homeHref}>Home</Link>
              </Button>
              <SignOutButton href={signOutHref} />
            </div>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant={bigScreen ? "secondary" : "outline"}
            onClick={() => setBigScreenMode(!bigScreen)}
          >
            {bigScreen ? "Exit hall" : "Hall view"}
          </Button>
        </div>
        {panels.length > 0 ? <PanelStandingStrip panels={panels} /> : null}
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 gap-2 p-2 md:p-3">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <LatestResult post={latestUpdate} holdOrder={holdOrder} />
        </main>
        <aside className="hidden min-h-0 w-[22rem] shrink-0 flex-col lg:flex xl:w-[26rem]">
          {current ? (
            <div key={current.id} className="flex min-h-0 flex-1 flex-col">
              <PostSection
                compact
                post={{
                  ...current,
                  votes_polled: current.votes_polled ?? election.total_votes_polled,
                }}
                flashKey={flashKey}
                serial={safeIndex + 1}
                requireVerification={display.results_require_verification}
              />
            </div>
          ) : (
            <p className="m-auto px-4 text-center text-xs font-bold uppercase tracking-wide text-slate-400">
              No posts configured yet.
            </p>
          )}
        </aside>
      </div>

      <footer className="relative z-10 flex h-20 shrink-0 items-stretch gap-0 overflow-hidden border-t border-slate-200 bg-white">
        <div className="flex h-full w-16 flex-col items-center justify-center bg-[#c9a227] px-2 text-center text-[11px] font-black tracking-[0.18em] text-slate-950">
          TALLY
        </div>
        {posts.length > 0 ? (
          <div key={cycle} className="relative h-full w-14 overflow-hidden bg-[#ead48a]">
            <div
              className="h-full bg-[#8a6b12]"
              style={{ animation: `resultsRotate ${rotateMs || DEFAULT_ROTATE_MS}ms linear` }}
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1 overflow-hidden">
          <AnnouncedTicker items={ticker} />
        </div>
        <div className="relative z-10 hidden h-full shrink-0 lg:block">
          <MulearnCredit compact />
        </div>
      </footer>
    </div>
  );
}

const TICKER_HOLD_MS = 4500;
const TICKER_SLIDE_MS = 900;

function AnnouncedTicker({ items }: { items: TickerItem[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const itemsKey = items
    .map((item) => `${item.post}:${item.label}:${item.people.map((person) => `${person.name}:${person.status}:${person.votes}`).join(",")}`)
    .join("|");
  const strip = items.length > 1 ? [...items, ...items] : items;

  useEffect(() => {
    const track = trackRef.current;
    if (!track || items.length <= 1) return;

    let index = 0;
    let timer = 0;
    let cancelled = false;

    function goTo(next: number, animate: boolean) {
      if (!track) return;
      const card = track.children[next] as HTMLElement | undefined;
      if (!card) return;
      track.style.transition = animate ? `transform ${TICKER_SLIDE_MS}ms ease-in-out` : "none";
      track.style.transform = `translateX(-${card.offsetLeft}px)`;
    }

    function loop() {
      if (cancelled) return;
      timer = window.setTimeout(() => {
        index += 1;
        goTo(index, true);
        if (index >= items.length) {
          timer = window.setTimeout(() => {
            index = 0;
            goTo(0, false);
            loop();
          }, TICKER_SLIDE_MS);
          return;
        }
        loop();
      }, TICKER_HOLD_MS);
    }

    goTo(0, false);
    loop();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [itemsKey, items.length]);

  if (!items.length) {
    return (
      <p className="flex h-full items-center px-4 text-sm font-bold uppercase tracking-wide text-slate-500">
        Awaiting the first count
      </p>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <div ref={trackRef} className="flex h-full w-max items-stretch">
        {strip.map((item, index) => (
          <TickerCard key={`${item.post}-${index}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function TickerCard({ item }: { item: TickerItem }) {
  const mixed = item.people.some((person) => person.status === "WON") && item.people.some((person) => person.status === "TIE");
  const verb =
    mixed ? "RESULT" : item.label === "WON" ? "WINS" : item.label === "TIE" ? "TIE" : item.label === "LEAD" ? "LEADING" : "COUNTING";

  return (
    <article className="flex h-full items-stretch border-r border-slate-200 bg-white">
      <div className="flex min-w-[7.5rem] max-w-[10rem] shrink-0 flex-col justify-center bg-slate-900 px-3 py-2 text-white">
        <span className="text-[9px] font-black tracking-[0.28em] text-red-400">POST</span>
        <p className="mt-0.5 text-[13px] font-black uppercase leading-tight tracking-wide">{item.post}</p>
      </div>
      <div className="flex items-center gap-3 px-3">
        {item.people.map((person) => {
          const theme = panelTheme(person.panel, person.color);
          const first = person.name.split(" ")[0] ?? person.name;
          const won = person.status === "WON";
          const lead = person.status === "LEAD";
          const trail = person.status === "TRAIL";
          const statusLabel =
            person.status === "WON"
              ? "WINNER"
              : person.status === "TIE"
                ? "TIED"
                : person.status === "LEAD"
                  ? "LEADING"
                  : "TRAILING";
          return (
            <div key={person.name} className="flex items-center gap-2">
              {person.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={person.photo_url}
                  alt=""
                  className={cn(
                    "size-14 shrink-0 rounded-full object-cover",
                    won || lead ? "ring-2 ring-slate-900" : "ring-1 ring-slate-300",
                  )}
                />
              ) : (
                <div
                  className={cn(
                    "flex size-14 shrink-0 items-center justify-center rounded-full text-xs font-black",
                    won || lead ? "ring-2 ring-slate-900" : "ring-1 ring-slate-300",
                  )}
                  style={{ background: theme.bg, color: theme.fg }}
                >
                  {initials(person.name)}
                </div>
              )}
              <div className="min-w-0 pr-1">
                <p
                  className={cn(
                    "text-[9px] font-black tracking-[0.22em]",
                    won ? "text-red-600" : lead ? "text-slate-700" : "text-slate-400",
                  )}
                >
                  {statusLabel}
                </p>
                <p className={cn("truncate text-lg font-black leading-none tracking-tight", trail ? "text-slate-500" : "text-slate-950")}>
                  {first}
                </p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {person.panel} · {person.votes}
                </p>
              </div>
            </div>
          );
        })}
        <span
          className={cn(
            "shrink-0 rounded-sm px-2 py-1 text-[10px] font-black tracking-[0.16em]",
            verb === "WINS"
              ? "bg-slate-900 text-white"
              : verb === "TIE"
                ? "border border-slate-400 text-slate-600"
                : "border border-slate-300 text-slate-500",
          )}
        >
          {verb}
        </span>
      </div>
    </article>
  );
}

function PanelStandingStrip({ panels }: { panels: PanelStanding[] }) {
  return (
    <div className="flex gap-px bg-white">
      {panels.map((panel) => (
        <PanelStandingCard key={panel.name} panel={panel} />
      ))}
    </div>
  );
}

function PanelStandingCard({ panel }: { panel: PanelStanding }) {
  const theme = panelTheme(panel.name, panel.color);
  const outcomes = [
    { label: "Won", value: panel.won },
    { label: "Lead", value: panel.lead },
    { label: "Tie", value: panel.tie },
  ];

  return (
    <div className="min-w-0 flex-1 px-3 py-2" style={{ background: theme.bg, color: theme.fg }}>
      <p className="truncate text-[11px] font-black uppercase tracking-[0.18em]">{panel.name}</p>
      <div className="mt-1 flex items-end gap-2 sm:gap-3">
        <div className="w-[3.75rem] shrink-0 sm:w-16">
          <LiveCounter value={panel.tally} className="block text-3xl font-black tabular-nums leading-none" />
          <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.14em] opacity-70">seats</p>
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-3">
          {outcomes.map((stat) => (
            <StandingStat key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StandingStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 text-center">
      <p className={cn("text-lg font-black tabular-nums leading-none sm:text-xl", value === 0 && "opacity-40")}>
        {formatNumber(value)}
      </p>
      <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.14em] opacity-70">{label}</p>
    </div>
  );
}
