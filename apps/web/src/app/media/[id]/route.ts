import { apiUrl } from "@/lib/api/session";

/** A product image uploaded in AltasGoods Control, streamed from the API. Ids are random and never reused, so it caches for a year. */
export async function GET(_req: Request, ctx: RouteContext<"/media/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  try {
    const r = await fetch(`${apiUrl()}/v1/media/${id}`, { cache: "force-cache" });
    if (!r.ok) return new Response("Not found", { status: r.status === 404 ? 404 : 502 });
    return new Response(r.body, {
      headers: {
        "Content-Type": r.headers.get("content-type") ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Image unavailable", { status: 503 });
  }
}
