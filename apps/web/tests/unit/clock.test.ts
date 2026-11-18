import { describe, expect, it } from "vitest";
import { arrivalHeadline, greeting, relativeDay } from "@/components/account/lib";
import { minutesUntil } from "@/components/admin/helpers";
import { dayDiff, minsUntil } from "@/components/logistics/ops-ui";
import { daysFromNow, msToCutoff, promiseDays, type PincodeInfo } from "@/components/store/delivery";
import { pickupSlots } from "@/lib/mock/account-extra";
import type { Order } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

const ist = (s: string) => new Date(`${s}+05:30`).getTime();
const metro = { extraDays: 0 } as PincodeInfo;

describe("promiseDays and the 14:00 IST cutoff", () => {
  it("counts an order before 14:00 as same-day", () => {
    expect(promiseDays(2, metro, ist("2026-11-18T13:59:59"))).toBe(2);
  });
  it("adds a day from 14:00 IST", () => {
    expect(promiseDays(2, metro, ist("2026-11-18T14:00:00"))).toBe(3);
    expect(promiseDays(2, metro, ist("2026-11-18T23:30:00"))).toBe(3);
  });
  it("adds the pincode's extra days and never goes below one", () => {
    expect(promiseDays(2, { extraDays: 2 } as PincodeInfo, ist("2026-11-18T10:00:00"))).toBe(4);
    expect(promiseDays(0, null, ist("2026-11-18T10:00:00"))).toBe(1);
  });
  it("measures the time left to the cutoff and clamps at zero", () => {
    expect(msToCutoff(ist("2026-11-18T13:00:00"))).toBe(3600_000);
    expect(msToCutoff(ist("2026-11-18T15:00:00"))).toBe(0);
  });
  it("dates a promise from the clock it is given", () => {
    expect(daysFromNow(2, 1000).getTime()).toBe(1000 + 2 * 86400_000);
  });
});

describe("relative dates follow the supplied clock", () => {
  const now = ist("2026-11-18T10:30:00");
  it("labels today, tomorrow and yesterday", () => {
    expect(relativeDay(new Date(ist("2026-11-18T22:00:00")), now)).toBe("today");
    expect(relativeDay(new Date(ist("2026-11-19T09:00:00")), now)).toBe("tomorrow");
    expect(relativeDay(new Date(ist("2026-11-17T09:00:00")), now)).toBe("yesterday");
  });
  it("uses the IST calendar day, not UTC", () => {
    // 00:30 IST on the 19th is still the 18th in UTC
    expect(relativeDay(new Date(ist("2026-11-19T00:30:00")), now)).toBe("tomorrow");
  });
  it("falls back to a date label further out", () => {
    expect(relativeDay(new Date(ist("2026-11-25T09:00:00")), now)).not.toMatch(/today|tomorrow|yesterday/);
  });
  it("greets by IST hour", () => {
    expect(greeting(ist("2026-11-18T08:00:00"))).toBe("Good morning");
    expect(greeting(ist("2026-11-18T13:00:00"))).toBe("Good afternoon");
    expect(greeting(ist("2026-11-18T20:00:00"))).toBe("Good evening");
  });
  it("reports a late parcel and an upcoming one", () => {
    const base = { status: "in_transit" } as Order;
    expect(arrivalHeadline({ ...base, promisedBy: "2026-11-17T12:00:00+05:30" } as Order, now)).toBe("Running late, now arriving tomorrow");
    expect(arrivalHeadline({ ...base, promisedBy: "2026-11-19T12:00:00+05:30" } as Order, now)).toBe("Arriving tomorrow");
  });
});

describe("other time helpers", () => {
  const now = ist("2026-11-18T10:30:00");
  it("computes minutes until a timestamp", () => {
    expect(minutesUntil("2026-11-18T12:30:00+05:30", now)).toBe(120);
    expect(minsUntil("2026-11-18T10:00:00+05:30", now)).toBe(-30);
  });
  it("diffs calendar days in IST", () => {
    expect(dayDiff("2026-11-18T23:59:00+05:30", now)).toBe(0);
    expect(dayDiff("2026-11-19T00:01:00+05:30", now)).toBe(1);
  });
  it("words an age against the given clock", () => {
    expect(timeAgo("2026-11-18T10:29:30+05:30", now)).toBe("just now");
    expect(timeAgo("2026-11-18T08:30:00+05:30", now)).toBe("2 h ago");
  });
  it("starts pickup slots the day after the given time and skips Sundays", () => {
    // 2026-11-18 is a Wednesday; next days Thu, Fri, Sat then Mon
    const slots = pickupSlots(4, now).map((s) => new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }).format(new Date(s.date)));
    expect(slots).toEqual(["Thu", "Fri", "Sat", "Mon"]);
  });
});
