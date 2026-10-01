"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Tracks an element's content width so SVG charts render crisp at any size.
 * Width is null until the first measurement, so charts never draw at a guessed
 * width (which would overflow narrow cards before hydration). The first
 * measurement is synchronous, before paint, so there is no empty flash.
 */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(120, Math.floor(el.getBoundingClientRect().width)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
