"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * The request time, rendered once on the server and handed to the client so the
 * first client render matches the server HTML. `useNow` returns that seed on the
 * first render and only starts following the real clock after mount.
 */
const NowContext = createContext<number | null>(null);

export function NowProvider({ now, children }: { now: number; children: ReactNode }) {
  return <NowContext.Provider value={now}>{children}</NowContext.Provider>;
}

/** Epoch ms. Pass `tickMs` to re-render on an interval (default 1s); 0 syncs once after mount. */
export function useNow(tickMs = 1000): number {
  const seed = useContext(NowContext);
  const [now, setNow] = useState<number>(seed ?? 0);
  useEffect(() => {
    // sync to the real clock right after hydration (deferred so the first client render still matches the server), then keep ticking
    const sync = setTimeout(() => setNow(Date.now()), 0);
    const id = tickMs ? setInterval(() => setNow(Date.now()), tickMs) : undefined;
    return () => {
      clearTimeout(sync);
      if (id) clearInterval(id);
    };
  }, [tickMs]);
  return now;
}
