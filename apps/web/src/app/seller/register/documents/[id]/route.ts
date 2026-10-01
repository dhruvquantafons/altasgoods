import { proxyFile } from "@/lib/api/server";

/** The applicant's own uploaded document, streamed through the server so the token stays in its cookie. */
export async function GET(_req: Request, ctx: RouteContext<"/seller/register/documents/[id]">) {
  const { id } = await ctx.params;
  return proxyFile(`/v1/me/seller-application/documents/${encodeURIComponent(id)}`);
}
