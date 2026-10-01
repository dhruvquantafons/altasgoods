import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "accent" | "danger" | "soft" | "link" | "dark";
type Size = "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm";

const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white shadow-xs hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300",
  dark: "bg-ink-900 text-white shadow-xs hover:bg-ink-800 active:bg-ink-950 disabled:bg-ink-400",
  secondary: "bg-white text-ink-800 border border-line-strong shadow-xs hover:bg-ink-50 active:bg-ink-100 disabled:text-ink-400",
  outline: "bg-transparent text-brand-700 border border-brand-200 hover:bg-brand-50 active:bg-brand-100 disabled:opacity-50",
  ghost: "bg-transparent text-ink-700 hover:bg-ink-100 active:bg-ink-200 disabled:opacity-50",
  soft: "bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-200 disabled:opacity-50",
  accent: "bg-accent-400 text-ink-950 shadow-xs hover:bg-accent-300 active:bg-accent-500 disabled:bg-accent-200 disabled:text-ink-500",
  danger: "bg-danger-600 text-white shadow-xs hover:bg-danger-700 disabled:bg-danger-300",
  link: "bg-transparent text-brand-700 hover:text-brand-800 hover:underline underline-offset-4 px-0! h-auto!",
};

const sizes: Record<Size, string> = {
  xs: "h-7 px-2.5 text-xs gap-1.5 rounded-md",
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-xl",
  icon: "size-10 rounded-lg",
  "icon-sm": "size-8 rounded-lg",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(
    "inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors duration-150 select-none",
    "disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
    variants[variant],
    sizes[size],
    className,
  );
}

type Common = {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  children?: ReactNode;
  className?: string;
};

type ButtonProps = Common & Omit<ComponentProps<"button">, "children" | "className">;
type LinkProps = Common & { href: string } & Omit<ComponentProps<typeof Link>, "children" | "className" | "href">;

function Inner({ icon: Icon, iconRight: IconRight, children, size }: Common) {
  const iconSize = size === "xs" || size === "sm" || size === "icon-sm" ? 15 : 17;
  return (
    <>
      {Icon && <Icon size={iconSize} strokeWidth={1.9} aria-hidden="true" />}
      {children}
      {IconRight && <IconRight size={iconSize} strokeWidth={1.9} aria-hidden="true" />}
    </>
  );
}

export function Button({ variant, size, icon, iconRight, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClasses({ variant, size, className })} {...rest}>
      <Inner icon={icon} iconRight={iconRight} size={size}>
        {children}
      </Inner>
    </button>
  );
}

export function ButtonLink({ variant, size, icon, iconRight, className, children, href, ...rest }: LinkProps) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, className })} {...rest}>
      <Inner icon={icon} iconRight={iconRight} size={size}>
        {children}
      </Inner>
    </Link>
  );
}
