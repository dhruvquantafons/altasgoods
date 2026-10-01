"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GalleryView {
  src: string;
  alt: string;
  /** crop applied to the shared packshot so each view reads as a different angle */
  scale: number;
  origin: string;
}

function viewStyle(v: GalleryView): CSSProperties {
  return { transform: `scale(${v.scale})`, transformOrigin: v.origin };
}

/**
 * Product gallery: vertical thumbnails on desktop, swipe plus a thumbnail
 * strip on mobile, hover zoom that follows the pointer, and a keyboard
 * friendly full-screen viewer.
 */
export function Gallery({ views, badge }: { views: GalleryView[]; badge?: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [viewer, setViewer] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const v = views[index]!;

  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewer(false);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % views.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + views.length) % views.length);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [viewer, views.length]);

  const onSwipe = () => {
    const el = stripRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };

  const pick = (i: number) => {
    setIndex(i);
    stripRef.current?.scrollTo({ left: i * (stripRef.current?.clientWidth ?? 0), behavior: "smooth" });
  };

  return (
    <div className="flex flex-col-reverse gap-3 lg:flex-row lg:gap-4">
      <div className="flex gap-2.5 overflow-x-auto scrollbar-none lg:flex-col lg:overflow-visible" role="tablist" aria-label="Product images">
        {views.map((t, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Show image ${i + 1} of ${views.length}`}
            onClick={() => pick(i)}
            onMouseEnter={() => setIndex(i)}
            className={cn(
              "relative size-16 shrink-0 overflow-hidden rounded-xl bg-ink-50 transition-shadow lg:size-[72px]",
              i === index ? "ring-2 ring-ink-900 ring-offset-2" : "ring-1 ring-line hover:ring-ink-300",
            )}
          >
            <Image src={t.src} alt="" fill sizes="80px" loading="eager" className="object-cover" style={viewStyle(t)} />
          </button>
        ))}
      </div>

      <div className="relative min-w-0 flex-1">
        {/* Desktop: hover zoom */}
        <button
          type="button"
          aria-label="Open full screen image viewer"
          onClick={() => setViewer(true)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
          }}
          onMouseLeave={() => setZoom(null)}
          className="relative hidden aspect-square w-full cursor-zoom-in overflow-hidden rounded-2xl bg-ink-50 lg:block"
        >
          <Image
            src={v.src}
            alt={v.alt}
            fill
            loading="eager"
            fetchPriority="high"
            sizes="(min-width: 1280px) 40vw, 50vw"
            className="object-cover transition-transform duration-200 ease-out"
            style={zoom ? { transform: `scale(${Math.max(2, v.scale * 1.6)})`, transformOrigin: `${zoom.x}% ${zoom.y}%` } : viewStyle(v)}
          />
          <span className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-ink-700 shadow-xs">
            <Expand size={13} aria-hidden="true" /> Hover to zoom, click to expand
          </span>
        </button>

        {/* Mobile: swipe */}
        <div ref={stripRef} onScroll={onSwipe} className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl scrollbar-none lg:hidden" aria-label="Product images, swipe for more">
          {views.map((t, i) => (
            <button key={i} type="button" onClick={() => setViewer(true)} className="relative aspect-square w-full shrink-0 snap-center overflow-hidden bg-ink-50" aria-label={`Open image ${i + 1} full screen`}>
              <Image src={t.src} alt={t.alt} fill loading={i === 0 ? "eager" : "lazy"} sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" style={viewStyle(t)} />
            </button>
          ))}
        </div>
        <span className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-ink-900/70 px-2.5 py-1 text-xs font-medium text-white tabular-nums lg:hidden">
          {index + 1} / {views.length}
        </span>
        {badge && <span className="pointer-events-none absolute top-3 left-3 rounded-md bg-ink-900 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white">{badge}</span>}
      </div>

      {/* portalled to the body: the sticky gallery column would otherwise trap it under the buy box */}
      {viewer &&
        createPortal(
        <div className="fixed inset-0 z-[80] flex flex-col bg-white animate-fade-in" role="dialog" aria-modal="true" aria-label="Image viewer">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-6">
            <p className="text-sm font-medium text-ink-700 tabular-nums">
              Image {index + 1} of {views.length}
            </p>
            <button type="button" autoFocus onClick={() => setViewer(false)} aria-label="Close viewer" className="flex size-10 items-center justify-center rounded-lg text-ink-600 hover:bg-ink-100">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-ink-50 p-4">
            <div className="relative aspect-square h-full max-h-[calc(100vh-11rem)] max-w-full overflow-hidden rounded-2xl">
              <Image src={v.src} alt={v.alt} fill sizes="90vw" className="object-cover" style={viewStyle(v)} />
            </div>
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + views.length) % views.length)}
              aria-label="Previous image"
              className="absolute left-4 flex size-11 items-center justify-center rounded-full bg-white shadow-raised hover:bg-ink-50"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % views.length)}
              aria-label="Next image"
              className="absolute right-4 flex size-11 items-center justify-center rounded-full bg-white shadow-raised hover:bg-ink-50"
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="flex justify-center gap-2.5 border-t border-line p-3">
            {views.map((t, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className={cn("relative size-14 overflow-hidden rounded-lg bg-ink-50", i === index ? "ring-2 ring-ink-900 ring-offset-2" : "ring-1 ring-line")}
              >
                <Image src={t.src} alt="" fill sizes="64px" className="object-cover" style={viewStyle(t)} />
              </button>
            ))}
          </div>
        </div>,
          document.body,
        )}
    </div>
  );
}
