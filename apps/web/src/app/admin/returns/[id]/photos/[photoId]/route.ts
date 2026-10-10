import { proxyFile } from "@/lib/api/server";

/** A customer's photo on a return, for store staff. */
export async function GET(_req: Request, ctx: RouteContext<"/admin/returns/[id]/photos/[photoId]">) {
  const { id, photoId } = await ctx.params;
  return proxyFile(`/v1/admin/returns/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`);
}
