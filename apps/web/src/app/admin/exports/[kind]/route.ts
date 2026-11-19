import { exportSearch } from "@/lib/api/exports";
import { proxyFile } from "@/lib/api/server";

/**
 * A CSV export of orders, order lines, payments, refunds, customers or the
 * audit log, passed through from the API with the page's filters. The API
 * checks the role; the file is streamed, not held in memory.
 */
export async function GET(req: Request, ctx: RouteContext<"/admin/exports/[kind]">) {
  const { kind } = await ctx.params;
  return proxyFile(`/v1/admin/exports/${encodeURIComponent(kind)}${exportSearch(new URL(req.url).searchParams)}`);
}
