import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Square product thumbnail on a soft neutral plate. Use everywhere a product
 * photo appears (cards, tables, order lines) so crops and radii stay consistent.
 */
export function ProductImage({
  src,
  alt,
  size,
  className,
  sizes,
  priority,
  rounded = "lg",
}: {
  src: string;
  alt: string;
  /** fixed pixel size for thumbnails; omit to fill the parent (parent needs a size) */
  size?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
  rounded?: "md" | "lg" | "xl" | "2xl";
}) {
  const r = { md: "rounded-md", lg: "rounded-lg", xl: "rounded-xl", "2xl": "rounded-2xl" }[rounded];
  if (size)
    return (
      <span className={cn("relative inline-block shrink-0 overflow-hidden bg-ink-50 ring-1 ring-line ring-inset", r, className)} style={{ width: size, height: size }}>
        <Image src={src} alt={alt} fill sizes={`${size * 2}px`} className="object-cover" priority={priority} />
      </span>
    );
  return (
    <span className={cn("relative block aspect-square w-full overflow-hidden bg-ink-50", r, className)}>
      <Image src={src} alt={alt} fill sizes={sizes ?? "(min-width: 1024px) 25vw, 50vw"} className="object-cover" priority={priority} />
    </span>
  );
}
