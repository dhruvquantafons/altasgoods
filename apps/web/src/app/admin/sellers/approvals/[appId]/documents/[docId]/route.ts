import { proxyFile } from "@/lib/api/server";

/** A document on a seller application, for reviewers. The API checks the staff role. */
export async function GET(_req: Request, ctx: RouteContext<"/admin/sellers/approvals/[appId]/documents/[docId]">) {
  const { appId, docId } = await ctx.params;
  return proxyFile(`/v1/admin/seller-applications/${encodeURIComponent(appId)}/documents/${encodeURIComponent(docId)}`);
}
