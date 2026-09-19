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
      const serialized = JSON.stringify(payload);
      const changed = serialized !== lastPayload.current;
      lastPayload.current = serialized;
      setData(payload as LiveResults);
      setError(null);
      if (withFlash && changed) setFlashKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load results");
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
