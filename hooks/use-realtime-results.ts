"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LiveResults } from "@/lib/types";

const POLL_MS = 2000;

export function useRealtimeResults() {
  const [data, setData] = useState<LiveResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const timer = useRef<number | null>(null);
  const lastPayload = useRef("");

  const fetchResults = useCallback(async (withFlash = false) => {
    try {
      const supabase = createClient();
      const { data: payload, error: rpcError } = await supabase.rpc("get_live_results");
      if (rpcError) throw rpcError;
      if (!payload || typeof payload !== "object") {
        throw new Error("Live results returned an empty payload.");
      }
      const results = payload as LiveResults;
      const serialized = JSON.stringify(results);
      const changed = serialized !== lastPayload.current;
      lastPayload.current = serialized;
      setData({
        ...results,
        posts: (Array.isArray(results.posts) ? results.posts : []).map((post) => ({
          ...post,
          candidates: Array.isArray(post.candidates)
            ? post.candidates.map((candidate) => ({
                ...candidate,
                slot_votes: Array.isArray(candidate.slot_votes) ? candidate.slot_votes : [],
              }))
            : [],
          invalid_votes: post.invalid_votes ?? 0,
          invalid_slot_votes: Array.isArray(post.invalid_slot_votes) ? post.invalid_slot_votes : [],
        })),
      });
      setError(null);
      if (withFlash && changed) setFlashKey((key) => key + 1);
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
          ? (err as { message: string }).message
          : "Could not load results";
      if (!lastPayload.current) setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const start = window.setTimeout(() => {
      void fetchResults(false);
    }, 0);

    let supabase: ReturnType<typeof createClient> | null = null;
    try {
      supabase = createClient();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Supabase is not configured";
      window.setTimeout(() => {
        setError(message);
        setLoading(false);
      }, 0);
      window.clearTimeout(start);
      return;
    }

    const schedule = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        void fetchResults(true);
      }, 280);
    };

    const poll = window.setInterval(() => {
      void fetchResults(true);
    }, POLL_MS);

    const channel = supabase
      .channel("results")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "results_tick" },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "count_rounds" },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "count_entries" },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "candidates" },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "panels" },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "elections" },
        schedule,
      )
      .subscribe();

    return () => {
      window.clearTimeout(start);
      window.clearInterval(poll);
      if (timer.current) window.clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [fetchResults]);

  return { data, error, loading, flashKey, refresh: fetchResults };
}
