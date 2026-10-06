import "server-only";
import { cache } from "react";
import { api } from "./server";

/** Open seller application counts for AltasGoods Control, shared by the layout and pages in one request. */
export const loadKycSummary = cache(async () => {
  try {
    const r = await (await api()).GET("/v1/admin/seller-applications", { params: { query: { tab: "open", page: 1, pageSize: 1 } } });
    if (!r.data) return null;
    const oldest = r.data.oldestOpenSubmittedAt;
    return {
      open: r.data.counts.open,
      awaitingReview: r.data.counts.awaitingReview,
      waitingOnSeller: r.data.counts.waitingOnSeller,
      oldestDays: oldest ? Math.floor((Date.parse(new Date().toISOString()) - Date.parse(oldest)) / 86_400_000) : null,
    };
  } catch {
    return null;
  }
});
