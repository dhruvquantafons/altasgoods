import { proxyFile } from "@/lib/api/server";

/** A photo on one of the signed-in customer's returns. */
export async function GET(_req: Request, ctx: RouteContext<"/account/returns/[id]/photos/[photoId]">) {
  const { id, photoId } = await ctx.params;
  return proxyFile(`/v1/me/returns/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`);
}
