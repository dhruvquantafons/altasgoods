import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-lg border border-line-strong bg-white text-sm text-ink-900 shadow-xs placeholder:text-ink-400 " +
  "transition-colors hover:border-ink-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 " +
  "disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400 aria-invalid:border-danger-500 aria-invalid:focus:ring-danger-100";

export function Input({
  className,
  icon: Icon,
  suffix,
  inputSize = "md",
  ...props
}: ComponentProps<"input"> & { icon?: LucideIcon; suffix?: ReactNode; inputSize?: "sm" | "md" | "lg" }) {
  const h = inputSize === "sm" ? "h-8 text-[13px]" : inputSize === "lg" ? "h-12 text-[15px]" : "h-10";
  if (!Icon && !suffix) return <input className={cn(field, h, "px-3", className)} {...props} />;
  return (
    <div className={cn("relative", className)}>
      {Icon && (
        <Icon size={16} strokeWidth={1.9} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" />
      )}
      <input className={cn(field, h, Icon ? "pl-9" : "pl-3", suffix ? "pr-16" : "pr-3")} {...props} />
      {suffix && <div className="absolute inset-y-0 right-2 flex items-center text-xs text-ink-500">{suffix}</div>}
    </div>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(field, "min-h-24 px-3 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({
  className,
  children,
  selectSize = "md",
  ...props
}: ComponentProps<"select"> & { selectSize?: "sm" | "md" }) {
  return (
    <div className={cn("relative", className)}>
      <select
        className={cn(field, "appearance-none pr-9 pl-3", selectSize === "sm" ? "h-8 text-[13px]" : "h-10")}
        {...props}
      >
        {children}
      </select>
      <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-400" />
    </div>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-[13px] font-medium text-ink-700", className)} {...props} />;
}

/** Label + control + hint/error, the standard vertical form row. */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-danger-600">*</span>}
      </Label>
      {children}
      {error ? <p className="text-xs text-danger-600">{error}</p> : hint ? <p className="text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

export function Checkbox({ className, label, description, ...props }: ComponentProps<"input"> & { label?: ReactNode; description?: ReactNode }) {
  const box = (
    <input
      type="checkbox"
      className={cn("size-4 shrink-0 rounded border-line-strong accent-brand-600 focus-visible:outline-brand-500", !label && className)}
      {...props}
    />
  );
  if (!label) return box;
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm text-ink-700", className)}>
      <span className="mt-0.5 flex">{box}</span>
      <span>
        {label}
        {description && <span className="block text-xs text-ink-500">{description}</span>}
      </span>
    </label>
  );
}

export function Radio({ className, label, description, ...props }: ComponentProps<"input"> & { label?: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm text-ink-700", className)}>
      <input type="radio" className="mt-0.5 size-4 shrink-0 accent-brand-600" {...props} />
      <span>
        {label}
        {description && <span className="block text-xs text-ink-500">{description}</span>}
      </span>
    </label>
  );
}
