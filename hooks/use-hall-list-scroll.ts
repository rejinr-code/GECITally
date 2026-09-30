import { useEffect, useRef } from "react";

export function useHallListScroll(resetKey: string, delayMs: number) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let cancelled = false;
    let dir: 1 | -1 = 1;
    let last = 0;
    let offset = 0;
    let holdUntil = performance.now() + delayMs;
    const SPEED = 42;

    el.scrollTop = 0;

    function frame(now: number) {
      if (cancelled || !el) return;
      const dt = last ? Math.min(48, now - last) : 16;
      last = now;
      const max = Math.max(0, el.scrollHeight - el.clientHeight);
      if (max <= 8) {
        offset = 0;
        el.scrollTop = 0;
        raf = window.requestAnimationFrame(frame);
        return;
      }
      if (now < holdUntil) {
        raf = window.requestAnimationFrame(frame);
        return;
      }
      offset += dir * SPEED * (dt / 1000);
      if (dir === 1 && offset >= max) {
        offset = max;
        dir = -1;
        holdUntil = now + 1400;
      } else if (dir === -1 && offset <= 0) {
        offset = 0;
        dir = 1;
        holdUntil = now + 1400;
      }
      el.scrollTop = offset;
      raf = window.requestAnimationFrame(frame);
    }

    raf = window.requestAnimationFrame(frame);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [resetKey, delayMs]);

  return ref;
}
