import { cn } from "@/lib/utils";

/**
 * Decorative barcode drawn from an identifier (deterministic widths), used on
 * label and manifest previews. The identifier is always printed beneath it.
 */
export function Barcode({ value, height = 56, className }: { value: string; height?: number; className?: string }) {
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  const seq = `*${value}*`;
  for (let i = 0; i < seq.length; i++) {
    const c = seq.charCodeAt(i);
    for (let k = 0; k < 4; k++) {
      const w = ((c >> k) & 3) + 1;
      if (k % 2 === 0) bars.push({ x, w });
      x += w;
    }
    x += 1;
  }
  return (
    <svg viewBox={`0 0 ${x} ${height}`} preserveAspectRatio="none" className={cn("block w-full", className)} style={{ height }} role="img" aria-label={`Barcode ${value}`}>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="currentColor" />
      ))}
    </svg>
  );
}
