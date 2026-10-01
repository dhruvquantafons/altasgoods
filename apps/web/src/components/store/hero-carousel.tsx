"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HeroSlideData {
  id: string;
  image: string;
  alt: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  align: "left" | "right";
  theme: "dark" | "light";
  position?: string;
}

const INTERVAL = 7000;

/**
 * Accessible hero carousel: live text over a scrim, 7 s slides, pauses on
 * hover and focus, stops for good after any interaction, a visible pause
 * control (WCAG 2.2.2), and no auto-rotation on small screens or with
 * reduced motion.
 */
export function HeroCarousel({ slides }: { slides: HeroSlideData[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!playing || held) return;
    const t = setInterval(() => {
      const still = window.matchMedia("(max-width: 767px), (prefers-reduced-motion: reduce)").matches;
      if (!still) setIndex((i) => (i + 1) % slides.length);
    }, INTERVAL);
    return () => clearInterval(t);
  }, [playing, held, slides.length]);

  const goTo = (i: number) => {
    setPlaying(false);
    setIndex((i + slides.length) % slides.length);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured offers"
      className="relative overflow-hidden rounded-2xl bg-ink-900"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      <div className="relative h-[400px] sm:h-[380px] lg:h-[440px]">
        {slides.map((s, i) => {
          const active = i === index;
          const dark = s.theme === "dark";
          return (
            <div
              key={s.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${slides.length}: ${s.title}`}
              aria-hidden={!active}
              inert={!active}
              className={cn("absolute inset-0 transition-opacity duration-700 ease-out", active ? "z-10 opacity-100" : "z-0 opacity-0")}
            >
              <Image
                src={s.image}
                alt={s.alt}
                fill
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : undefined}
                sizes="(min-width: 1400px) 1336px, 100vw"
                className={cn("object-cover transition-transform duration-[7000ms] ease-linear", active ? "scale-[1.03]" : "scale-100")}
                style={{ objectPosition: s.position ?? "center" }}
              />
              {/* scrims keep live text readable at every width */}
              <div
                aria-hidden="true"
                className={cn(
                  "absolute inset-0 sm:hidden",
                  dark ? "bg-gradient-to-t from-black/85 via-black/45 to-black/5" : "bg-gradient-to-t from-white via-white/80 to-white/0",
                )}
              />
              <div
                aria-hidden="true"
                className={cn(
                  "absolute inset-0 hidden sm:block",
                  s.align === "left" ? "bg-gradient-to-r" : "bg-gradient-to-l",
                  dark ? "from-black/80 via-black/40 to-transparent" : "from-white/95 via-white/65 to-transparent",
                )}
              />
              <div className={cn("relative flex h-full items-end p-6 pb-20 sm:items-center sm:p-10 lg:p-14", s.align === "right" && "sm:justify-end")}>
                <div className="max-w-md">
                  <p
                    className={cn(
                      "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                      dark ? "bg-white/12 text-white ring-1 ring-white/20 backdrop-blur" : "bg-ink-900/[0.06] text-ink-800 ring-1 ring-ink-900/10",
                    )}
                  >
                    {s.eyebrow}
                  </p>
                  <h2 className={cn("mt-4 text-[28px] leading-[1.1] font-semibold tracking-tight sm:text-4xl lg:text-[44px]", dark ? "text-white" : "text-ink-900")}>
                    {s.title}
                  </h2>
                  <p className={cn("mt-3 text-[15px] leading-relaxed sm:text-base", dark ? "text-white/80" : "text-ink-600")}>{s.body}</p>
                  <Link
                    href={s.href}
                    tabIndex={active ? 0 : -1}
                    className={cn(
                      "mt-6 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors",
                      dark ? "bg-white text-ink-900 hover:bg-ink-100" : "bg-ink-900 text-white hover:bg-ink-800",
                    )}
                  >
                    {s.cta}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute right-4 bottom-4 z-20 flex items-center gap-1 rounded-full bg-white/90 p-1 shadow-raised ring-1 ring-ink-900/5 backdrop-blur sm:right-6 sm:bottom-6">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause slideshow" : "Play slideshow"}
          className="flex size-8 items-center justify-center rounded-full text-ink-700 hover:bg-ink-100"
        >
          {playing ? <Pause size={14} fill="currentColor" aria-hidden="true" /> : <Play size={14} fill="currentColor" aria-hidden="true" />}
        </button>
        <button type="button" onClick={() => goTo(index - 1)} aria-label="Previous slide" className="flex size-8 items-center justify-center rounded-full text-ink-700 hover:bg-ink-100">
          <ChevronLeft size={17} aria-hidden="true" />
        </button>
        <div className="flex items-center gap-1.5 px-1" role="group" aria-label="Choose slide">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show slide ${i + 1}: ${s.title}`}
              aria-current={i === index ? "true" : undefined}
              className="flex h-6 items-center"
            >
              <span className={cn("block h-1.5 rounded-full transition-all duration-300", i === index ? "w-6 bg-ink-900" : "w-1.5 bg-ink-300 hover:bg-ink-400")} />
            </button>
          ))}
        </div>
        <button type="button" onClick={() => goTo(index + 1)} aria-label="Next slide" className="flex size-8 items-center justify-center rounded-full text-ink-700 hover:bg-ink-100">
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
