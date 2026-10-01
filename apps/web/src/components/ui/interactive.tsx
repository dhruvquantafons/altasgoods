"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------- Tabs -------------------------------- */

/** Client-side tabs for switching panels without navigation. */
export function Tabs({
  tabs,
  defaultTab,
  className,
  variant = "underline",
}: {
  tabs: { key: string; label: ReactNode; content: ReactNode }[];
  defaultTab?: string;
  className?: string;
  variant?: "underline" | "pill";
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key);
  const id = useId();
  return (
    <div className={className}>
      <div
        role="tablist"
        className={cn(
          variant === "pill" ? "inline-flex gap-1 rounded-xl bg-ink-100 p-1" : "flex gap-6 overflow-x-auto border-b border-line scrollbar-none",
        )}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            id={`${id}-${t.key}`}
            aria-selected={t.key === active}
            aria-controls={`${id}-${t.key}-panel`}
            onClick={() => setActive(t.key)}
            className={cn(
              "relative shrink-0 text-sm font-medium transition-colors",
              variant === "pill"
                ? cn("h-8 rounded-lg px-3 text-[13px]", t.key === active ? "bg-white text-ink-900 shadow-xs" : "text-ink-500 hover:text-ink-800")
                : cn("h-11", t.key === active ? "text-ink-900" : "text-ink-500 hover:text-ink-800"),
            )}
          >
            {t.label}
            {variant === "underline" && t.key === active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-600" />}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" id={`${id}-${t.key}-panel`} aria-labelledby={`${id}-${t.key}`} hidden={t.key !== active} className="pt-5">
          {t.content}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- Modal -------------------------------- */

/** Centered dialog (or right-side sheet with side="right"). Controlled. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  side = "center",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  side?: "center" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  const width = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        className={cn(
          "absolute flex",
          side === "right" ? "inset-y-0 right-0 w-full justify-end" : "inset-0 items-center justify-center p-4",
        )}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          className={cn(
            "flex w-full flex-col bg-white shadow-pop outline-none animate-fade-in",
            width,
            side === "right" ? "h-full" : "max-h-[90vh] rounded-2xl",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-ink-900">{title}</h2>
              {description && <p className="mt-0.5 text-[13px] text-ink-500">{description}</p>}
            </div>
            <button onClick={onClose} className="-mr-2 rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin">{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-3.5">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Switch ------------------------------- */

export function Switch({
  checked,
  defaultChecked,
  onChange,
  label,
  description,
  disabled,
  ariaLabel,
}: {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (v: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  /** accessible name when there is no visible label (e.g. a toggle inside a table) */
  ariaLabel?: string;
}) {
  const [inner, setInner] = useState(defaultChecked ?? false);
  const on = checked ?? inner;
  const btn = (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        setInner(!on);
        onChange?.(!on);
      }}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        on ? "bg-brand-600" : "bg-ink-200",
      )}
    >
      <span className={cn("inline-block size-4 rounded-full bg-white shadow-xs transition-transform", on ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
  if (!label) return btn;
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-ink-900">{label}</p>
        {description && <p className="mt-0.5 text-[13px] text-ink-500">{description}</p>}
      </div>
      {btn}
    </div>
  );
}

/* ------------------------------- Popover ------------------------------ */

/** Click-to-open floating panel anchored to a trigger (menus, filters, pickers). */
export function Popover({
  trigger,
  children,
  align = "end",
  className,
}: {
  trigger: (open: boolean) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "start" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const close = () => setOpen(false);
  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open && (
        <div
          className={cn(
            "absolute top-full z-40 mt-2 min-w-56 rounded-xl border border-line bg-white p-1.5 shadow-pop animate-fade-in",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </div>
  );
}

/** A row inside a Popover menu. */
export function MenuItem({
  children,
  onClick,
  icon,
  danger,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
        danger ? "text-danger-700 hover:bg-danger-50" : "text-ink-700 hover:bg-ink-50 hover:text-ink-900",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/* -------------------------------- Toast ------------------------------- */

/** Minimal inline confirmation that fades out; good enough for mock actions. */
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  const node = msg ? (
    <div role="status" className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-ink-900 px-4 py-2.5 text-sm font-medium text-white shadow-pop animate-fade-in">
      {msg}
    </div>
  ) : null;
  return { show: setMsg, node };
}
