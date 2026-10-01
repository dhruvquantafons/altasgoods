import { proxyFile } from "@/lib/api/server";

/** A customer's photo on a return the seller handles. */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/seller/returns/[id]/photos/[photoId]">,
) {
  const { id, photoId } = await ctx.params;
  return proxyFile(
    `/v1/seller/returns/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`,
  );
}
