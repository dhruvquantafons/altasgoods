import { describe, expect, it } from "vitest";
import { arrivesByOf, gradeDueOf, nextStepOf, reviewDueOf, toSellerReturnRow } from "@/lib/api/seller-returns";
import type { ReturnRequest } from "@/lib/api/types";
import received from "./fixtures/return-received.json";
import pending from "./fixtures/return-pending-review.json";
import pickedUp from "./fixtures/return-picked-up.json";

const HOUR = 3_600_000;
const at = (r: ReturnRequest, status: string) => r.events.findLast((e) => e.toStatus === status)!.at;

describe("seller returns from the API", () => {
  const rec = received as unknown as ReturnRequest;
  const pen = pending as unknown as ReturnRequest;
  const pic = pickedUp as unknown as ReturnRequest;

  it("puts requests to decide and items to grade under Needs action", () => {
    expect(toSellerReturnRow(pen).tab).toBe("action");
    expect(toSellerReturnRow(rec).tab).toBe("action");
    expect(toSellerReturnRow(pic).tab).toBe("progress");
  });

  it("lets the seller decide only requests outside the window", () => {
    const row = toSellerReturnRow(pen);
    expect(row.canDecide).toBe(true);
    expect(row.outOfPolicy).toBe(true);
    expect(row.next).toEqual({ text: "Approve or reject", due: new Date(Date.parse(at(pen, "PENDING_SELLER_REVIEW")) + 48 * HOUR).toISOString() });
    // an approved late request still shows it was out of policy, but the decision is made
    const approved = toSellerReturnRow(rec);
    expect(approved.outOfPolicy).toBe(true);
    expect(approved.canDecide).toBe(false);
  });

  it("gives 48 hours to grade from receipt, and nothing to grade before", () => {
    expect(gradeDueOf(rec)).toBe(new Date(Date.parse(at(rec, "RECEIVED")) + 48 * HOUR).toISOString());
    expect(gradeDueOf(pic)).toBeUndefined();
    expect(reviewDueOf(rec)).toBeUndefined();
    expect(nextStepOf(rec).text).toBe("Grade the item");
  });

  it("expects a picked up item three days after pickup", () => {
    expect(arrivesByOf(pic)).toBe(new Date(Date.parse(at(pic, "PICKED_UP")) + 72 * HOUR).toISOString());
    expect(nextStepOf(pic).text).toMatch(/^Arrives by /);
  });

  it("converts amounts, masks the buyer and labels the resolution", () => {
    const row = toSellerReturnRow(pic);
    // a replacement refunds nothing, so it is worth the item's value
    expect(row.amount).toBe((pic.item.unitPricePaise * pic.qty) / 100);
    expect(toSellerReturnRow(rec).amount).toBe(rec.refundAmountPaise / 100);
    expect(row.resolution).toBe("Replacement");
    expect(row.buyer).toMatch(/^\S+( \S\.)?$/);
    expect(row.href).toBe(`/seller/returns/${pic.id}`);
    expect(row.status.label).toBe("Picked up");
  });

  it("reads each closing status as a next step", () => {
    const as = (status: string) => nextStepOf({ ...rec, status } as ReturnRequest).text;
    expect(as("QC_FAILED")).toBe("BluBuy is reviewing your check");
    expect(as("REJECTED")).toBe("Rejected");
    expect(as("CANCELLED")).toBe("Cancelled by the customer");
    expect(as("COMPLETED")).toBe("No action needed");
    expect(toSellerReturnRow({ ...rec, status: "QC_FAILED" } as ReturnRequest).tab).toBe("progress");
    expect(toSellerReturnRow({ ...rec, status: "COMPLETED" } as ReturnRequest).tab).toBe("done");
  });
});
