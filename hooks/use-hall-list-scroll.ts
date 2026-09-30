import { useEffect, useRef } from "react";

export function useHallListScroll(resetKey: string, delayMs: number, enabled = true) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;

    let raf = 0;
    let cancelled = false;
    let dir: 1 | -1 = 1;
    let last = 0;
    let offset = 0;
    let holdUntil = 0;
    const SPEED = 42;

    function tick(now: number) {
      if (cancelled) return;
      const node = ref.current;
      if (!node) {
        raf = window.requestAnimationFrame(tick);
        return;
      }

      if (!holdUntil) {
        node.scrollTop = 0;
        holdUntil = now + delayMs;
      }

      const max = Math.max(0, node.scrollHeight - node.clientHeight);
      if (max <= 2) {
        offset = 0;
        dir = 1;
        last = now;
        raf = window.requestAnimationFrame(tick);
        return;
      }

      if (now < holdUntil) {
        last = now;
        raf = window.requestAnimationFrame(tick);
        return;
      }

      const dt = last ? Math.min(48, now - last) : 16;
      last = now;
      offset = Math.min(max, Math.max(0, offset + dir * SPEED * (dt / 1000)));
      if (dir === 1 && offset >= max - 0.5) {
        offset = max;
        dir = -1;
        holdUntil = now + 1400;
      } else if (dir === -1 && offset <= 0.5) {
        offset = 0;
        dir = 1;
        holdUntil = now + 1400;
      }
      node.scrollTop = offset;
      raf = window.requestAnimationFrame(tick);
    }

    raf = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [resetKey, delayMs, enabled]);

  return ref;
}
