import { proxyFile } from "@/lib/api/server";

/** A ticket attachment for Care Desk staff. */
export async function GET(_req: Request, ctx: RouteContext<"/support/attachments/[id]">) {
  const { id } = await ctx.params;
  return proxyFile(`/v1/support/attachments/${encodeURIComponent(id)}`);
}
