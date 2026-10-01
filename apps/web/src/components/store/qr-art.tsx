import { seeded } from "@/lib/utils";

/**
 * Placeholder QR pattern for the UPI QR option (deterministic from the seed).
 * The live integration renders the gateway's dynamic UPI QR here.
 */
export function QrArt({ seed, size = 168, label }: { seed: string; size?: number; label: string }) {
  const n = 25;
  const rand = seeded([...seed].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0);
  const finder = (x: number, y: number) => {
    const inBox = (ox: number, oy: number) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7;
    for (const [ox, oy] of [
      [0, 0],
      [n - 7, 0],
      [0, n - 7],
    ] as const) {
      if (inBox(ox, oy)) {
        const dx = x - ox;
        const dy = y - oy;
        return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4) ? 1 : 0;
      }
      if (x >= ox - 1 && x <= ox + 7 && y >= oy - 1 && y <= oy + 7) return 0;
    }
    return -1;
  };
  const cells: [number, number][] = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const f = finder(x, y);
      const on = f === -1 ? rand() > 0.52 : f === 1;
      if (on) cells.push([x, y]);
    }
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} width={size} height={size} role="img" aria-label={label} className="rounded-lg bg-white">
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="white" />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill="#101828" />
      ))}
    </svg>
  );
}
