import { proxyFile } from "@/lib/api/server";

/** A file on one of the signed-in customer's own conversations. */
export async function GET(_req: Request, ctx: RouteContext<"/account/support/attachments/[id]">) {
  const { id } = await ctx.params;
  return proxyFile(`/v1/me/support/attachments/${encodeURIComponent(id)}`);
}
