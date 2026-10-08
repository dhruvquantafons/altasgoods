/**
 * Extra mock data for the AltasGoods Hub Console (logistics, FC Console, Rider app
 * preview) and the AltasGoods Care Desk. Deterministic and anchored to NOW like the
 * rest of the mock layer. Each block mirrors an entity in
 * docs/research/01-marketplace-workflows.md section 12.
 */
import type { Customer, Order, Shipment, Ticket } from "../types";
import type { NdrReason, TicketPriority } from "../status";
import { between, NOW, pick, seeded, sum } from "../utils";
import { products } from "./catalog";
import { tickets } from "./engagement";
import { associates, CURRENT_HUB_ID, hourlyDeliveries, shipments } from "./logistics";
import { getOrder, orders, returns } from "./orders";
import { customers, sellers } from "./people";

/* ================================================================== */
/* Time helpers (Asia/Kolkata)                                         */
/* ================================================================== */

const nowIstMinutes = (NOW.getUTCHours() * 60 + NOW.getUTCMinutes() + 330) % 1440;

/** Midnight IST of the NOW day. */
export const DAY_START = new Date(NOW.getTime() - nowIstMinutes * 60_000);

/** ISO timestamp for a clock time on the NOW day (dayOffset -1 is yesterday). */
export function istAt(hour: number, minute = 0, dayOffset = 0) {
  return new Date(DAY_START.getTime() + dayOffset * 86_400_000 + (hour * 60 + minute) * 60_000).toISOString();
}

const minsAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

/** Current hour of the day in IST (10 at 10:30 AM). */
export const NOW_HOUR = Math.floor(nowIstMinutes / 60);

/* ================================================================== */
/* Hub day: plan, completed hours and yesterday                        */
/* ================================================================== */

/** Hours of today's delivery window that have fully finished (8 AM and 9 AM at 10:30 AM). */
export const completedHours = hourlyDeliveries.filter((_, i) => (8 + i + 1) * 60 <= nowIstMinutes);

/** Deliveries in the running (incomplete) hour. Counted in totals, never charted. */
export const currentHourDelivered = hourlyDeliveries.find((_, i) => 8 + i === NOW_HOUR)?.delivered ?? 0;

export const HUB_DAY = {
  planned: sum(hourlyDeliveries, (h) => h.planned),
  deliveredSoFar: sum(completedHours, (h) => h.delivered) + currentHourDelivered,
  plannedSoFar: sum(completedHours, (h) => h.planned),
  deliveredCompletedHours: sum(completedHours, (h) => h.delivered),
  shift: "Morning shift, 7:00 AM to 4:00 PM",
  wave2At: istAt(13, 0),
  firstAttemptRate: 91.8,
  firstAttemptRateYesterday: 90.6,
  yesterdayDelivered: 0,
};

/** Yesterday's full-day deliveries per hour at the current hub (complete day). */
export const yesterdayHourly = hourlyDeliveries.map((h, i) => {
  const r = seeded(700 + i)();
  return { hour: h.hour, delivered: Math.round(h.planned * (0.9 + r * 0.14)) };
});
HUB_DAY.yesterdayDelivered = sum(yesterdayHourly, (h) => h.delivered);

/* ================================================================== */
/* Beats (delivery zones) served by Whitefield Delivery Hub            */
/* ================================================================== */

export interface Beat {
  code: string;
  name: string;
  locality: string;
  pincode: string;
}

export const beats: Beat[] = [
  { code: "WFD-01", name: "Whitefield Main Road", locality: "Whitefield", pincode: "560066" },
  { code: "WFD-02", name: "ITPL and Hoodi", locality: "Whitefield", pincode: "560066" },
  { code: "WFD-03", name: "Brookefield", locality: "Brookefield", pincode: "560037" },
  { code: "WFD-04", name: "Kundalahalli Gate", locality: "Brookefield", pincode: "560037" },
  { code: "WFD-05", name: "Marathahalli Bridge", locality: "Marathahalli", pincode: "560048" },
  { code: "WFD-06", name: "Kadugodi and Belathur", locality: "Kadugodi", pincode: "560067" },
  { code: "WFD-07", name: "Varthur Kodi", locality: "Varthur", pincode: "560087" },
  { code: "WFD-08", name: "Gunjur and Balagere", locality: "Varthur", pincode: "560087" },
  { code: "WFD-09", name: "Bellandur Lake Road", locality: "Bellandur", pincode: "560103" },
  { code: "WFD-10", name: "KR Puram Station", locality: "KR Puram", pincode: "560016" },
  { code: "WFD-11", name: "Mahadevapura", locality: "Mahadevapura", pincode: "560036" },
  { code: "WFD-12", name: "Garudacharpalya", locality: "Mahadevapura", pincode: "560036" },
  { code: "WFD-13", name: "Seegehalli and Hope Farm", locality: "Kadugodi", pincode: "560067" },
];

export function beatForPincode(pincode: string) {
  return beats.find((b) => b.pincode === pincode);
}

/* ================================================================== */
/* Associate profiles (supplements the shared associates list)         */
/* ================================================================== */

export interface AssociateProfile {
  id: string;
  vehicleNo: string;
  joinedAt: string;
  kyc: "verified" | "pending";
  checkedInAt?: string;
  firstAttemptRate: number;
  fakeAttemptFlags: number;
  last7: number[];
  languages: string[];
  employment: "Full time" | "Partner";
}

const hubDAs = associates.filter((a) => a.hubId === CURRENT_HUB_ID);

export const associateProfiles: Record<string, AssociateProfile> = Object.fromEntries(
  associates.map((a, i) => {
    const r = seeded(4400 + i);
    const series = Array.from({ length: 7 }, () => between(r, 22, 46));
    return [
      a.id,
      {
        id: a.id,
        vehicleNo: a.vehicle === "van" ? `KA 53 C ${between(r, 1000, 9999)}` : `KA ${pick(r, ["01", "03", "53"])} ${pick(r, ["HN", "JK", "EX", "HW"])} ${between(r, 1000, 9999)}`,
        joinedAt: new Date(NOW.getTime() - between(r, 90, 1300) * 86_400_000).toISOString(),
        kyc: i === 11 ? "pending" : "verified",
        checkedInAt: a.status === "off_duty" ? undefined : istAt(7, between(r, 18, 58)),
        firstAttemptRate: Math.round((86 + r() * 11) * 10) / 10,
        fakeAttemptFlags: i === 6 ? 2 : i === 10 ? 1 : 0,
        last7: series,
        languages: pick(r, [["Kannada", "Hindi"], ["Kannada", "English"], ["Tamil", "Kannada"], ["Hindi", "Urdu", "Kannada"], ["Telugu", "Kannada"]]),
        employment: i % 4 === 3 ? "Partner" : "Full time",
      } satisfies AssociateProfile,
    ];
  }),
);

/* ================================================================== */
/* Runsheets (section 11.12)                                           */
/* ================================================================== */

export type RunsheetStatus = "created" | "assigned" | "dispatched" | "returned_to_hub" | "closed" | "cancelled";
export type StopStatus = "delivered" | "failed" | "pending" | "picked_up";

export interface RunStop {
  seq: number;
  awb: string;
  customer: string;
  locality: string;
  pincode: string;
  slot: string;
  kind: "delivery" | "pickup";
  cod: number;
  secure: boolean;
  openBox: boolean;
  status: StopStatus;
  at?: string;
  reason?: NdrReason;
}

export interface Runsheet {
  id: string;
  associateId?: string;
  beat: Beat;
  wave: 1 | 2;
  status: RunsheetStatus;
  stops: number;
  deliveries: number;
  pickups: number;
  delivered: number;
  failed: number;
  pickedUp: number;
  codToCollect: number;
  codCollected: number;
  plannedStartAt: string;
  dispatchedAt?: string;
  expectedReturnAt: string;
  distanceKm: number;
  lastScanAt?: string;
  onBreak?: boolean;
  sequence: RunStop[];
}

const rs = seeded(9091);
const firstNames = ["Aditi", "Rakesh", "Nandini", "Sameer", "Harini", "Vikas", "Pallavi", "Arvind", "Shruti", "Naresh", "Bhavana", "Tarun", "Keerthi", "Mohit", "Lakshmi", "Irfan", "Swati", "Ganesh", "Rekha", "Ashwin"];
const lastInitials = ["R", "K", "S", "M", "P", "N", "V", "D", "B", "G"];

function awb(r: () => number) {
  return `BBL${between(r, 1000000000, 9999999999)}`;
}

/** Largest-remainder allocation of an integer total across weights. */
function allocate(total: number, weights: number[], caps: number[]) {
  const wsum = weights.reduce((a, w) => a + w, 0) || 1;
  const raw = weights.map((w) => (w / wsum) * total);
  const out = raw.map((v, i) => Math.min(caps[i]!, Math.floor(v)));
  let left = total - out.reduce((a, v) => a + v, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  let guard = 0;
  while (left > 0 && guard < 1000) {
    for (const [, i] of order) {
      if (left <= 0) break;
      if (out[i]! < caps[i]!) {
        out[i]! += 1;
        left -= 1;
      }
    }
    guard += 1;
  }
  return out;
}

const working = hubDAs.filter((a) => a.status !== "off_duty");
const dispatchedDAs = working.filter((a) => a.status === "on_route" || a.status === "on_break");
const failedPlan = dispatchedDAs.map(() => between(rs, 0, 2));
const deliveredPlan = allocate(
  HUB_DAY.deliveredSoFar,
  dispatchedDAs.map((a) => a.assigned * (0.7 + rs() * 0.6)),
  dispatchedDAs.map((a, i) => a.assigned - failedPlan[i]! - 3),
);

function shuffle<T>(r: () => number, arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function buildSequence(r: () => number, beat: Beat, deliveries: number, pickups: number, delivered: number, failed: number, pickedUp: number, startAt: number): RunStop[] {
  const total = deliveries + pickups;
  // done stops first (in sequence order), pending after; pickups spread through both
  const done: StopStatus[] = shuffle(r, [
    ...Array<StopStatus>(pickedUp).fill("picked_up"),
    ...Array<StopStatus>(delivered).fill("delivered"),
    ...Array<StopStatus>(failed).fill("failed"),
  ]);
  const pending: RunStop["kind"][] = shuffle(r, [
    ...Array<RunStop["kind"]>(pickups - pickedUp).fill("pickup"),
    ...Array<RunStop["kind"]>(deliveries - delivered - failed).fill("delivery"),
  ]);
  const plan: { kind: RunStop["kind"]; status: StopStatus }[] = [
    ...done.map((status) => ({ kind: (status === "picked_up" ? "pickup" : "delivery") as RunStop["kind"], status })),
    ...pending.map((kind) => ({ kind, status: "pending" as StopStatus })),
  ];
  let minute = startAt;
  return plan.map(({ kind, status }, i) => {
    minute += between(r, 4, 9);
    const reason: NdrReason | undefined =
      status === "failed" ? pick(r, ["customer_unavailable", "customer_unavailable", "premises_closed", "cod_not_ready", "reschedule_requested", "address_incomplete"] as NdrReason[]) : undefined;
    const cod = kind === "delivery" && r() < 0.38 ? pick(r, [349, 499, 799, 1199, 1499, 1899, 2499, 3299, 4999, 6499, 8999]) : 0;
    return {
      seq: i + 1,
      awb: awb(r),
      customer: `${pick(r, firstNames)} ${pick(r, lastInitials)}.`,
      locality: beat.name,
      pincode: beat.pincode,
      slot: i < total * 0.55 ? "9 AM to 1 PM" : "1 PM to 5 PM",
      kind,
      cod,
      secure: kind === "delivery" && r() < 0.18,
      openBox: kind === "delivery" && r() < 0.07,
      status,
      at: status === "pending" ? undefined : istAt(0, Math.min(minute, nowIstMinutes - 2)),
      reason,
    };
  });
}

export const runsheets: Runsheet[] = (() => {
  const list: Runsheet[] = [];
  working.forEach((a, idx) => {
    const r = seeded(6100 + idx);
    const beat = beats[idx % beats.length]!;
    const di = dispatchedDAs.indexOf(a);
    const dispatched = di >= 0;
    const pickups = between(r, 0, 3);
    const deliveries = Math.max(10, a.assigned - pickups);
    const failed = dispatched ? failedPlan[di]! : 0;
    const delivered = dispatched ? Math.min(deliveredPlan[di]!, deliveries - failed) : 0;
    const pickedUp = dispatched ? Math.min(pickups, between(r, 0, pickups)) : 0;
    const startMin = 8 * 60 + between(r, 2, 62);
    const sequence = buildSequence(r, beat, deliveries, pickups, delivered, failed, pickedUp, startMin);
    const codToCollect = sum(sequence, (s) => s.cod);
    const codCollected = sum(sequence.filter((s) => s.status === "delivered"), (s) => s.cod);
    list.push({
      id: `RS-WFD-261001-${String(idx + 1).padStart(2, "0")}`,
      associateId: a.id,
      beat,
      wave: dispatched ? 1 : 2,
      status: dispatched ? "dispatched" : "assigned",
      stops: deliveries + pickups,
      deliveries,
      pickups,
      delivered,
      failed,
      pickedUp,
      codToCollect,
      codCollected,
      plannedStartAt: dispatched ? istAt(0, startMin - 5) : istAt(11, 0),
      dispatchedAt: dispatched ? istAt(0, startMin) : undefined,
      expectedReturnAt: dispatched ? istAt(14, between(r, 0, 50)) : istAt(16, 30),
      distanceKm: between(r, 24, 58),
      lastScanAt: dispatched ? minsAgo(between(r, 2, 26)) : undefined,
      onBreak: a.status === "on_break",
      sequence,
    });
  });
  // wave 2 runsheets created by the planner but not yet assigned
  [beats[3]!, beats[9]!].forEach((beat, k) => {
    const r = seeded(6200 + k);
    const deliveries = between(r, 22, 30);
    const sequence = buildSequence(r, beat, deliveries, 1, 0, 0, 0, 13 * 60);
    list.push({
      id: `RS-WFD-261001-${String(working.length + k + 1).padStart(2, "0")}`,
      beat,
      wave: 2,
      status: "created",
      stops: deliveries + 1,
      deliveries,
      pickups: 1,
      delivered: 0,
      failed: 0,
      pickedUp: 0,
      codToCollect: sum(sequence, (s) => s.cod),
      codCollected: 0,
      plannedStartAt: istAt(13, 0),
      expectedReturnAt: istAt(18, 30),
      distanceKm: between(r, 28, 44),
      sequence,
    });
  });
  return list;
})();

export function runsheetFor(associateId: string) {
  return runsheets.find((r) => r.associateId === associateId);
}

/* ================================================================== */
/* Line haul, bags, inbound discrepancies                              */
/* ================================================================== */

export type LineHaulStatus = "scheduled" | "in_transit" | "delayed" | "arrived" | "unloading" | "received";

export interface LineHaul {
  id: string;
  manifestId: string;
  vehicle: string;
  originHubId: string;
  mode: "surface" | "air";
  departedAt?: string;
  scheduledAt: string;
  etaAt: string;
  arrivedAt?: string;
  status: LineHaulStatus;
  bags: number;
  bagsReceived: number;
  shipments: number;
  shipmentsScanned: number;
  seal: string;
  sealIntact: boolean;
  driver: string;
  dock?: string;
  delayMins: number;
}

export const lineHauls: LineHaul[] = [
  { id: "LH-261001-0412", manifestId: "MNF-HYD-261001-03", vehicle: "TS 08 UB 7731", originHubId: "h-hyd-sc", mode: "surface", departedAt: istAt(19, 40, -1), scheduledAt: istAt(5, 30), etaAt: istAt(5, 30), arrivedAt: istAt(5, 41), status: "received", bags: 42, bagsReceived: 42, shipments: 612, shipmentsScanned: 610, seal: "SL-883412", sealIntact: true, driver: "Mallikarjun H", dock: "Dock 1", delayMins: 11 },
  { id: "LH-261001-0419", manifestId: "MNF-BLR-261001-01", vehicle: "KA 51 AF 2290", originHubId: "h-blr-fc", mode: "surface", departedAt: istAt(5, 10), scheduledAt: istAt(7, 0), etaAt: istAt(7, 0), arrivedAt: istAt(6, 55), status: "received", bags: 28, bagsReceived: 28, shipments: 386, shipmentsScanned: 385, seal: "SL-883507", sealIntact: true, driver: "Shivakumar P", dock: "Dock 2", delayMins: 0 },
  { id: "LH-261001-0427", manifestId: "MNF-DEL-261001-AIR-02", vehicle: "KA 05 MG 1184", originHubId: "h-del-fc", mode: "air", departedAt: istAt(3, 15), scheduledAt: istAt(8, 15), etaAt: istAt(8, 15), arrivedAt: istAt(8, 22), status: "unloading", bags: 18, bagsReceived: 14, shipments: 236, shipmentsScanned: 171, seal: "SL-883611", sealIntact: true, driver: "Ramesh Babu", dock: "Dock 3", delayMins: 7 },
  { id: "LH-261001-0433", manifestId: "MNF-BLR-261001-02", vehicle: "KA 51 AF 2318", originHubId: "h-blr-fc", mode: "surface", departedAt: istAt(8, 20), scheduledAt: istAt(10, 0), etaAt: istAt(10, 0), arrivedAt: istAt(10, 6), status: "arrived", bags: 24, bagsReceived: 0, shipments: 318, shipmentsScanned: 0, seal: "SL-883690", sealIntact: false, driver: "Nagaraj K", dock: "Dock 1", delayMins: 6 },
  { id: "LH-261001-0438", manifestId: "MNF-BOM-261001-07", vehicle: "MH 04 KF 6620", originHubId: "h-bom-fc", mode: "surface", departedAt: istAt(15, 30, -1), scheduledAt: istAt(10, 55), etaAt: istAt(11, 40), status: "delayed", bags: 36, bagsReceived: 0, shipments: 498, shipmentsScanned: 0, seal: "SL-882977", sealIntact: true, driver: "Sandeep Pawar", delayMins: 45 },
  { id: "LH-261001-0446", manifestId: "MNF-HYD-261001-05", vehicle: "TS 08 UB 7802", originHubId: "h-hyd-sc", mode: "surface", departedAt: istAt(3, 50), scheduledAt: istAt(13, 30), etaAt: istAt(13, 20), status: "in_transit", bags: 31, bagsReceived: 0, shipments: 441, shipmentsScanned: 0, seal: "SL-883755", sealIntact: true, driver: "Yadagiri M", delayMins: 0 },
  { id: "LH-261001-0451", manifestId: "MNF-BLR-261001-03", vehicle: "KA 51 AF 2290", originHubId: "h-blr-fc", mode: "surface", scheduledAt: istAt(15, 0), etaAt: istAt(15, 0), status: "scheduled", bags: 22, bagsReceived: 0, shipments: 296, shipmentsScanned: 0, seal: "Pending", sealIntact: true, driver: "Shivakumar P", delayMins: 0 },
];

export type BagStatus = "pending" | "received" | "debagged" | "short" | "damaged";

export interface Bag {
  id: string;
  lineHaulId: string;
  beatCode: string;
  shipments: number;
  scanned: number;
  weightKg: number;
  status: BagStatus;
  scannedAt?: string;
}

export const bags: Bag[] = lineHauls
  .filter((l) => l.status === "unloading" || l.status === "arrived" || l.status === "received")
  .flatMap((l, li) => {
    const r = seeded(3300 + li);
    return Array.from({ length: l.bags }, (_, i) => {
      const n = Math.max(6, Math.round(l.shipments / l.bags + between(r, -4, 4)));
      const received = i < l.bagsReceived;
      let status: BagStatus = received ? "debagged" : "pending";
      if (l.status === "unloading" && received && i >= l.bagsReceived - 3) status = "received";
      if (l.id === "LH-261001-0427" && i === 5) status = "damaged";
      if (l.id === "LH-261001-0419" && i === 17) status = "short";
      const scanned = status === "debagged" || status === "damaged" ? n : status === "short" ? n - 1 : status === "received" ? between(r, 0, n - 2) : 0;
      return {
        id: `BG-${l.id.slice(-4)}-${String(i + 1).padStart(3, "0")}`,
        lineHaulId: l.id,
        beatCode: beats[(i + li) % beats.length]!.code,
        shipments: n,
        scanned,
        weightKg: Math.round((n * (1.1 + r() * 1.6)) * 10) / 10,
        status,
        scannedAt: received ? istAt(0, (l.arrivedAt ? (new Date(l.arrivedAt).getTime() - DAY_START.getTime()) / 60_000 : 360) + 6 + i * 2) : undefined,
      } satisfies Bag;
    });
  });

export type DiscrepancyKind = "short" | "excess" | "damaged" | "misrouted";

export interface InboundDiscrepancy {
  id: string;
  awb: string;
  kind: DiscrepancyKind;
  lineHaulId: string;
  bagId: string;
  raisedAt: string;
  status: "open" | "investigating" | "resolved";
  note: string;
  value: number;
}

export const inboundDiscrepancies: InboundDiscrepancy[] = [
  { id: "DSC-7781", awb: "BBL4471902615", kind: "short", lineHaulId: "LH-261001-0412", bagId: "BG-0412-019", raisedAt: istAt(6, 32), status: "investigating", note: "In manifest, not found in bag. Origin asked to check outbound CCTV.", value: 2499 },
  { id: "DSC-7782", awb: "BBL8820476113", kind: "short", lineHaulId: "LH-261001-0412", bagId: "BG-0412-033", raisedAt: istAt(6, 47), status: "open", note: "Bag seal intact, weight 0.6 kg under manifest.", value: 899 },
  { id: "DSC-7785", awb: "BBL1937562280", kind: "excess", lineHaulId: "LH-261001-0419", bagId: "BG-0419-008", raisedAt: istAt(7, 21), status: "resolved", note: "Belongs to HSR Layout hub. Re-bagged on transfer lane.", value: 1299 },
  { id: "DSC-7786", awb: "BBL6650183927", kind: "short", lineHaulId: "LH-261001-0419", bagId: "BG-0419-018", raisedAt: istAt(7, 38), status: "open", note: "Bag scanned short by 1. Awaiting origin confirmation.", value: 5499 },
  { id: "DSC-7790", awb: "BBL3305918842", kind: "damaged", lineHaulId: "LH-261001-0427", bagId: "BG-0427-006", raisedAt: istAt(8, 51), status: "open", note: "Outer carton crushed, liquid seepage. Photos uploaded, held for QC.", value: 3299 },
  { id: "DSC-7791", awb: "BBL7719402368", kind: "misrouted", lineHaulId: "LH-261001-0427", bagId: "BG-0427-011", raisedAt: istAt(9, 4), status: "investigating", note: "Pincode 560102 belongs to HSR Layout hub. Transfer on next shuttle.", value: 749 },
  { id: "DSC-7793", awb: "BBL5528830147", kind: "excess", lineHaulId: "LH-261001-0427", bagId: "BG-0427-012", raisedAt: istAt(9, 18), status: "open", note: "Not on manifest MNF-DEL-261001-AIR-02. Label valid for 560037.", value: 1999 },
];

/** Shipments sorted to each beat today (inbound so far) versus expected. */
export const sortByBeat = beats.map((b, i) => {
  const r = seeded(5100 + i);
  const expected = between(r, 82, 168);
  const sorted = Math.min(expected, Math.round(expected * (0.62 + r() * 0.3)));
  return { beat: b, expected, sorted };
});

/** Today's volume per pincode served by the hub, scaled to the day's plan, with 30-day NDR and COD shares. */
export const pincodeStats = (() => {
  const byPin = new Map<string, { locality: string; expected: number }>();
  for (const s of sortByBeat) {
    const cur = byPin.get(s.beat.pincode);
    byPin.set(s.beat.pincode, { locality: cur?.locality ?? s.beat.locality, expected: (cur?.expected ?? 0) + s.expected });
  }
  const total = [...byPin.values()].reduce((a, v) => a + v.expected, 0) || 1;
  const ndr: Record<string, number> = { "560066": 4.8, "560037": 5.6, "560048": 7.9, "560067": 13.6, "560087": 9.4, "560103": 6.1, "560016": 11.2, "560036": 8.3 };
  const cod: Record<string, number> = { "560066": 31, "560037": 28, "560048": 42, "560067": 57, "560087": 46, "560103": 24, "560016": 61, "560036": 44 };
  return [...byPin.entries()]
    .map(([pincode, v]) => {
      const volume = Math.round((v.expected / total) * HUB_DAY.planned);
      return { pincode, locality: v.locality, volume, ndrRate: ndr[pincode] ?? 6, codShare: cod[pincode] ?? 35 };
    })
    .sort((a, b) => b.volume - a.volume);
})();

/* ================================================================== */
/* NDR cases (section 11.7)                                            */
/* ================================================================== */

export type NdrCaseStatus = "open" | "awaiting_customer" | "disputed" | "reattempt_scheduled" | "reattempt_in_progress" | "resolved_delivered" | "rto_approved";

export interface NdrResponse {
  kind: "reattempt" | "address_update" | "cancel" | "disputed" | "cod_to_prepaid" | "none";
  channel?: "WhatsApp" | "SMS" | "IVR" | "App";
  at?: string;
  date?: string;
  note?: string;
}

export interface NdrCase {
  id: string;
  awb: string;
  shipment: Shipment;
  reason: NdrReason;
  attempts: number;
  firstAttemptAt: string;
  lastAttemptAt: string;
  associateId?: string;
  status: NdrCaseStatus;
  response: NdrResponse;
  actionDueAt: string;
  geoDistanceM: number;
  fakeAttemptFlag: boolean;
}

const ndrResponsePlan: { status: NdrCaseStatus; response: Omit<NdrResponse, "at">; ageMins: number }[] = [
  { status: "reattempt_scheduled", response: { kind: "reattempt", channel: "WhatsApp", date: istAt(10, 0, 0), note: "Available after 6 PM" }, ageMins: 980 },
  { status: "awaiting_customer", response: { kind: "none" }, ageMins: 190 },
  { status: "reattempt_scheduled", response: { kind: "address_update", channel: "App", date: istAt(10, 0, 1), note: "Added tower and flat number: Tower C, Flat 1102" }, ageMins: 1120 },
  { status: "disputed", response: { kind: "disputed", channel: "IVR", note: "Customer says they were home all day" }, ageMins: 420 },
  { status: "awaiting_customer", response: { kind: "none" }, ageMins: 1310 },
  { status: "reattempt_scheduled", response: { kind: "reattempt", channel: "SMS", date: istAt(10, 0, 1) }, ageMins: 860 },
  { status: "open", response: { kind: "cancel", channel: "App", note: "Ordered by mistake, please cancel" }, ageMins: 75 },
  { status: "reattempt_in_progress", response: { kind: "reattempt", channel: "WhatsApp", date: istAt(10, 0, 0) }, ageMins: 1440 },
  { status: "reattempt_scheduled", response: { kind: "address_update", channel: "WhatsApp", date: istAt(10, 0, 1), note: "Landmark: behind Lakeside Mall service road" }, ageMins: 700 },
  { status: "awaiting_customer", response: { kind: "none" }, ageMins: 1385 },
  { status: "reattempt_scheduled", response: { kind: "cod_to_prepaid", channel: "App", date: istAt(10, 0, 1), note: "Paid ₹1,899 by UPI link" }, ageMins: 600 },
];

const myShipments = shipments.filter((s) => s.destinationHubId === CURRENT_HUB_ID);

export const ndrCases: NdrCase[] = [
  ...myShipments
    .filter((s) => s.status === "ndr")
    .map((s, i) => {
      const plan = ndrResponsePlan[i % ndrResponsePlan.length]!;
      const r = seeded(8800 + i);
      const last = new Date(NOW.getTime() - plan.ageMins * 60_000);
      const first = new Date(last.getTime() - (s.attempts - 1) * 26 * 3600_000);
      const flagged = plan.response.kind === "disputed";
      return {
        id: `NDR-${s.id.slice(-6)}`,
        awb: s.id,
        shipment: s,
        reason: s.ndrReason ?? "customer_unavailable",
        attempts: s.attempts,
        firstAttemptAt: first.toISOString(),
        lastAttemptAt: last.toISOString(),
        associateId: s.associateId,
        status: plan.status,
        response: { ...plan.response, at: plan.response.kind === "none" ? undefined : new Date(last.getTime() + between(r, 20, 140) * 60_000).toISOString() },
        actionDueAt: new Date(last.getTime() + 24 * 3600_000).toISOString(),
        geoDistanceM: flagged ? 740 : between(r, 12, 160),
        fakeAttemptFlag: flagged,
      } satisfies NdrCase;
    }),
  ...myShipments
    .filter((s) => s.status === "rto_initiated" || s.status === "rto_in_transit")
    .map((s, i) => {
      const last = new Date(NOW.getTime() - (900 + i * 410) * 60_000);
      return {
        id: `NDR-${s.id.slice(-6)}`,
        awb: s.id,
        shipment: s,
        reason: s.ndrReason ?? "customer_refused",
        attempts: 3,
        firstAttemptAt: new Date(last.getTime() - 50 * 3600_000).toISOString(),
        lastAttemptAt: last.toISOString(),
        associateId: s.associateId,
        status: "rto_approved" as const,
        response: { kind: "none" as const },
        actionDueAt: last.toISOString(),
        geoDistanceM: 40 + i * 13,
        fakeAttemptFlag: false,
      } satisfies NdrCase;
    }),
];

/* ================================================================== */
/* Reverse pickups (doorstep QC) and RTO back to sellers               */
/* ================================================================== */

export type ReversePickupStatus = "scheduled" | "out_for_pickup" | "picked_up" | "qc_failed" | "customer_unavailable";

export interface QcCheck {
  key: "match" | "mrp_tag" | "accessories" | "unused" | "packaging";
  label: string;
  result: "pass" | "fail" | "na" | "pending";
}

export interface ReversePickup {
  id: string;
  returnId: string;
  orderId: string;
  awb: string;
  productTitle: string;
  image: string;
  reason: string;
  customer: string;
  beat: Beat;
  slot: string;
  associateId?: string;
  status: ReversePickupStatus;
  value: number;
  refundAtPickup: boolean;
  checks: QcCheck[];
  sellerId: string;
  note?: string;
  attempt: number;
}

const qcLabels: Record<QcCheck["key"], string> = {
  match: "Product matches image and serial",
  mrp_tag: "MRP tag present",
  accessories: "Accessories and freebies complete",
  unused: "Unused and unwashed",
  packaging: "Original packaging",
};

const reverseStatusPlan: ReversePickupStatus[] = ["picked_up", "scheduled", "out_for_pickup", "picked_up", "qc_failed", "out_for_pickup", "scheduled", "picked_up", "customer_unavailable", "scheduled", "out_for_pickup", "picked_up", "scheduled", "out_for_pickup"];

export const reversePickups: ReversePickup[] = returns.slice(0, 14).map((rt, i) => {
  const r = seeded(7300 + i);
  const status = reverseStatusPlan[i]!;
  const failIndex = between(r, 0, 4);
  const checks: QcCheck[] = (Object.keys(qcLabels) as QcCheck["key"][]).map((key, k) => ({
    key,
    label: qcLabels[key],
    result:
      status === "picked_up"
        ? key === "packaging" && r() < 0.3
          ? "na"
          : "pass"
        : status === "qc_failed"
          ? k === failIndex
            ? "fail"
            : k < failIndex
              ? "pass"
              : "pending"
          : "pending",
  }));
  const beat = beats[(i * 5) % beats.length]!;
  return {
    id: `RVP-${String(55120 + i * 7)}`,
    returnId: rt.id,
    orderId: rt.orderId,
    awb: `BBR${between(r, 1000000000, 9999999999)}`,
    productTitle: rt.productTitle,
    image: rt.image,
    reason: rt.reason,
    customer: `${pick(r, firstNames)} ${pick(r, lastInitials)}.`,
    beat,
    slot: i % 3 === 0 ? "9 AM to 1 PM" : "1 PM to 5 PM",
    associateId: status === "scheduled" ? undefined : working[(i * 3) % working.length]!.id,
    status,
    value: rt.amount,
    refundAtPickup: rt.amount <= 5000 && i % 4 !== 2,
    checks,
    sellerId: rt.sellerId,
    note: status === "qc_failed" ? `Doorstep QC failed on "${qcLabels[checks[failIndex]!.key].toLowerCase()}". Customer informed, return reverted.` : status === "customer_unavailable" ? "Customer not reachable on 2 calls. Attempt 2 of 3 tomorrow." : undefined,
    attempt: status === "customer_unavailable" ? 1 : 1,
  } satisfies ReversePickup;
});

export type RtoStatus = "rto_initiated" | "bagged" | "rto_in_transit" | "rto_delivered";

export interface RtoShipment {
  awb: string;
  linked: boolean;
  sellerId: string;
  originHubId: string;
  reason: NdrReason | "damaged" | "cancelled_in_transit";
  attempts: number;
  initiatedAt: string;
  status: RtoStatus;
  bagId?: string;
  value: number;
  cod: boolean;
  lane: string;
}

const laneLabel = (origin: string) => {
  const code = { "h-bom-fc": "BOM-FC-02", "h-del-fc": "DEL-FC-01", "h-blr-fc": "BLR-FC-01", "h-hyd-sc": "HYD-SC-01" }[origin] ?? "BLR-FC-01";
  return `BLR-DH-WFD to ${code}`;
};

export const rtoShipments: RtoShipment[] = (() => {
  const real = myShipments.filter((s) => s.status === "rto_initiated" || s.status === "rto_in_transit");
  const list: RtoShipment[] = real.map((s, i) => ({
    awb: s.id,
    linked: true,
    sellerId: s.sellerId,
    originHubId: s.originHubId,
    reason: s.ndrReason ?? "customer_refused",
    attempts: s.attempts,
    initiatedAt: minsAgo(300 + i * 280),
    status: s.status === "rto_in_transit" ? "rto_in_transit" : i % 2 === 0 ? "bagged" : "rto_initiated",
    bagId: s.status === "rto_in_transit" || i % 2 === 0 ? `RB-WFD-${4410 + i}` : undefined,
    value: getOrder(s.orderId)?.total ?? 1499,
    cod: s.cod,
    lane: laneLabel(s.originHubId),
  }));
  const r = seeded(7700);
  const reasons: RtoShipment["reason"][] = ["customer_refused", "customer_unavailable", "address_incomplete", "damaged", "cancelled_in_transit", "out_of_delivery_area"];
  for (let i = 0; i < 8; i++) {
    const origin = pick(r, ["h-bom-fc", "h-del-fc", "h-blr-fc", "h-hyd-sc"]);
    const status = (["rto_initiated", "bagged", "rto_in_transit", "rto_delivered", "rto_initiated", "rto_in_transit", "bagged", "rto_delivered"] as RtoStatus[])[i]!;
    list.push({
      awb: awb(r),
      linked: false,
      sellerId: pick(r, sellers.filter((s) => s.status === "active")).id,
      originHubId: origin,
      reason: reasons[i % reasons.length]!,
      attempts: reasons[i % reasons.length] === "customer_refused" || reasons[i % reasons.length] === "out_of_delivery_area" || reasons[i % reasons.length] === "damaged" || reasons[i % reasons.length] === "cancelled_in_transit" ? 1 : 3,
      initiatedAt: minsAgo(between(r, 200, 4200)),
      status,
      bagId: status === "rto_initiated" ? undefined : `RB-WFD-${between(r, 4300, 4409)}`,
      value: pick(r, [599, 1299, 2199, 3499, 7999, 12999, 1899]),
      cod: r() < 0.6,
      lane: laneLabel(origin),
    });
  }
  return list;
})();

/* ================================================================== */
/* COD: associate cash, deposits, bank slips, remittance (11.12)       */
/* ================================================================== */

export type CashDepositStatus = "not_declared" | "declared" | "accepted" | "short" | "banked" | "reconciled";

export interface CashDeposit {
  id: string;
  associateId: string;
  businessDate: string;
  codShipments: number;
  expected: number;
  upi: number;
  declared?: number;
  accepted?: number;
  short: number;
  status: CashDepositStatus;
  cashier?: string;
  declaredAt?: string;
}

const cashiers = ["Geetha R", "Abhilash M"];

export const cashDepositsYesterday: CashDeposit[] = hubDAs.map((a, i) => {
  const r = seeded(9400 + i);
  const codShipments = between(r, 6, 17);
  const total = codShipments * between(r, 720, 1650);
  const upi = Math.round(total * (0.28 + r() * 0.3));
  const expected = total - upi;
  let status: CashDepositStatus = i % 5 === 1 ? "reconciled" : "banked";
  if (i === 2 || i === 9 || i === 13) status = "not_declared";
  if (i === 6) status = "short";
  if (i === 4) status = "declared";
  const short = status === "short" ? 1200 : 0;
  const declared = status === "not_declared" ? undefined : expected - short;
  return {
    id: `CD-WFD-260930-${String(i + 1).padStart(2, "0")}`,
    associateId: a.id,
    businessDate: istAt(0, 0, -1),
    codShipments,
    expected,
    upi,
    declared,
    accepted: status === "declared" || status === "not_declared" ? undefined : expected - short,
    short,
    status,
    cashier: status === "not_declared" ? undefined : cashiers[i % 2],
    declaredAt: status === "not_declared" ? undefined : istAt(18, between(r, 5, 55), -1),
  } satisfies CashDeposit;
});

export interface BankDeposit {
  slip: string;
  businessDate: string;
  depositedAt: string;
  amount: number;
  bank: string;
  depositedBy: string;
  status: "banked" | "reconciled" | "pending";
  reference: string;
}

export const bankDeposits: BankDeposit[] = Array.from({ length: 6 }, (_, i) => {
  const r = seeded(9600 + i);
  return {
    slip: `DS-WFD-${String(260930 - i * 1)}-${between(r, 10, 99)}`,
    businessDate: istAt(0, 0, -1 - i),
    depositedAt: istAt(10, between(r, 5, 50), -i),
    amount: i === 0 ? sum(cashDepositsYesterday.filter((d) => d.status === "banked" || d.status === "reconciled"), (d) => d.accepted ?? 0) : between(r, 162000, 248000),
    bank: "Deccan Commercial Bank, Whitefield branch",
    depositedBy: cashiers[i % 2]!,
    status: i === 0 ? "banked" : "reconciled",
    reference: `DCB${between(r, 100000000, 999999999)}`,
  };
});

export interface Remittance {
  id: string;
  cycle: string;
  businessDate: string;
  amount: number;
  shipments: number;
  status: "scheduled" | "processing" | "remitted" | "reconciled";
  utr?: string;
  remittedAt?: string;
}

export const remittances: Remittance[] = Array.from({ length: 6 }, (_, i) => {
  const r = seeded(9700 + i);
  const status: Remittance["status"] = i === 0 ? "scheduled" : i === 1 ? "processing" : i < 4 ? "remitted" : "reconciled";
  return {
    id: `RM-WFD-${String(i + 1).padStart(3, "0")}-${between(r, 100, 999)}`,
    cycle: "D+1",
    businessDate: istAt(0, 0, -1 - i),
    amount: (i === 0 ? bankDeposits[0]!.amount : between(r, 164000, 251000)) + between(r, 38000, 72000),
    shipments: between(r, 160, 260),
    status,
    utr: status === "remitted" || status === "reconciled" ? `UTR${between(r, 100000000000, 999999999999)}` : undefined,
    remittedAt: status === "remitted" || status === "reconciled" ? istAt(16, between(r, 0, 50), -i) : undefined,
  };
});

export interface CashShortage {
  id: string;
  associateId: string;
  businessDate: string;
  amount: number;
  reason: string;
  status: "open" | "recovery_scheduled" | "recovered";
}

export const cashShortages: CashShortage[] = [
  { id: "SH-2291", associateId: hubDAs[6]!.id, businessDate: istAt(0, 0, -1), amount: 1200, reason: "Two ₹500 notes and one ₹200 note short against declared cash", status: "open" },
  { id: "SH-2284", associateId: hubDAs[10]!.id, businessDate: istAt(0, 0, -4), amount: 650, reason: "UPI payment marked as cash on one COD shipment", status: "recovery_scheduled" },
  { id: "SH-2270", associateId: hubDAs[1]!.id, businessDate: istAt(0, 0, -9), amount: 300, reason: "Change not returned at handover", status: "recovered" },
];

/* ================================================================== */
/* FC Console snapshots (section 9.7)                                  */
/* ================================================================== */

export type AppointmentStatus = "scheduled" | "checked_in" | "receiving" | "grn_posted" | "no_show";
export type PickListStatus = "released" | "picking" | "picked" | "short_pick" | "planned";

export interface FcAppointment {
  id: string;
  sellerId: string;
  slot: string;
  dock: string;
  boxes: number;
  unitsExpected: number;
  unitsReceived: number;
  damaged: number;
  excess: number;
  status: AppointmentStatus;
}

export interface FcPickList {
  id: string;
  wave: string;
  cutoff: string;
  lane: string;
  priority: "Plus one-day" | "Standard" | "Secure Delivery";
  orders: number;
  units: number;
  picked: number;
  zone: string;
  picker: string;
  status: PickListStatus;
}

export interface FcPackStation {
  id: string;
  packer: string;
  status: "active" | "idle" | "offline";
  packedToday: number;
  ratePerHr: number;
  queue: number;
  secureBags: boolean;
}

export interface FcOutbound {
  lane: string;
  destination: string;
  cutoff: string;
  packages: number;
  loaded: number;
  trailer: string;
  status: "loading" | "closed" | "departed" | "planned";
}

export interface FcSnapshot {
  hubId: string;
  shift: string;
  unitsReceived: number;
  unitsPlanned: number;
  putawayBacklog: number;
  ordersToPick: number;
  nextCutoff: string;
  packRate: number;
  packRateTarget: number;
  dispatched: number;
  inventoryAccuracy: number;
  dockToStockHrs: number;
  returnsBacklog: number;
  appointments: FcAppointment[];
  putaway: { zone: string; totes: number; units: number; oldestMins: number }[];
  pickLists: FcPickList[];
  packStations: FcPackStation[];
  outbound: FcOutbound[];
  cycleCounts: { zone: string; bins: number; counted: number; accuracy: number; variances: number }[];
}

const fcPeople = ["Anitha K", "Sudeep R", "Pooja N", "Mahesh B", "Farida S", "Joseph D", "Rani M", "Vijay T", "Kavya L", "Imtiaz A", "Sowmya P", "Raju G"];

function fcSnapshot(hubId: string, seed: number, scale: number, lanes: [string, string][]): FcSnapshot {
  const r = seeded(seed);
  const fbSellers = sellers.filter((s) => s.fulfillment.includes("blubuy_fulfilled"));
  const apptStatus: AppointmentStatus[] = ["grn_posted", "grn_posted", "receiving", "receiving", "checked_in", "scheduled", "scheduled", "no_show", "scheduled"];
  const appointments: FcAppointment[] = apptStatus.map((status, i) => {
    const unitsExpected = between(r, 120, 1800) * scale;
    const unitsReceived = status === "grn_posted" ? unitsExpected - between(r, 0, 12) : status === "receiving" ? Math.round(unitsExpected * (0.3 + r() * 0.5)) : 0;
    const hour = 6 + i;
    return {
      id: `INB-${hubId.slice(2, 5).toUpperCase()}-${between(r, 40000, 49999)}`,
      sellerId: fbSellers[(i + seed) % fbSellers.length]!.id,
      slot: `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? "PM" : "AM"} to ${hour + 1 > 12 ? hour + 1 - 12 : hour + 1}:00 ${hour + 1 >= 12 ? "PM" : "AM"}`,
      dock: `D-${String(between(r, 1, 14)).padStart(2, "0")}`,
      boxes: Math.max(4, Math.round(unitsExpected / between(r, 18, 40))),
      unitsExpected,
      unitsReceived,
      damaged: status === "grn_posted" || status === "receiving" ? between(r, 0, 6) : 0,
      excess: status === "grn_posted" && r() < 0.4 ? between(r, 1, 8) : 0,
      status,
    };
  });
  const cutoffs = [istAt(11, 30), istAt(13, 0), istAt(15, 0), istAt(17, 30), istAt(20, 0)];
  const pickStatus: PickListStatus[] = ["picked", "picking", "picking", "short_pick", "released", "released", "planned", "planned"];
  const pickLists: FcPickList[] = pickStatus.map((status, i) => {
    const units = between(r, 60, 220) * scale;
    const picked = status === "picked" ? units : status === "picking" ? Math.round(units * (0.35 + r() * 0.5)) : status === "short_pick" ? units - between(r, 1, 4) : 0;
    const [lane] = lanes[i % lanes.length]!;
    return {
      id: `PL-${between(r, 100000, 999999)}`,
      wave: `W${String(i < 4 ? 7 + Math.floor(i / 2) : 9 + Math.floor((i - 4) / 2)).padStart(2, "0")}`,
      cutoff: cutoffs[Math.min(cutoffs.length - 1, Math.floor(i / 2))]!,
      lane,
      priority: i === 0 || i === 2 ? "Plus one-day" : i === 5 ? "Secure Delivery" : "Standard",
      orders: Math.round(units / (1.2 + r() * 0.5)),
      units,
      picked,
      zone: pick(r, ["A: fast movers", "B: medium", "C: bulky", "S: secure cage"]),
      picker: fcPeople[(i + seed) % fcPeople.length]!,
      status,
    };
  });
  const packStations: FcPackStation[] = Array.from({ length: 8 }, (_, i) => {
    const status: FcPackStation["status"] = i === 6 ? "idle" : i === 7 ? "offline" : "active";
    return {
      id: `PS-${String(i + 1).padStart(2, "0")}`,
      packer: status === "offline" ? "Unstaffed" : fcPeople[(i + seed + 3) % fcPeople.length]!,
      status,
      packedToday: status === "offline" ? 0 : between(r, 140, 320) * scale,
      ratePerHr: status === "offline" ? 0 : status === "idle" ? 0 : between(r, 52, 88),
      queue: status === "active" ? between(r, 4, 26) : 0,
      secureBags: i === 2 || i === 5,
    };
  });
  const outbound: FcOutbound[] = lanes.map(([lane, destination], i) => {
    const packages = between(r, 180, 620) * scale;
    const status: FcOutbound["status"] = i === 0 ? "departed" : i === 1 ? "loading" : i === 2 ? "loading" : "planned";
    return {
      lane,
      destination,
      cutoff: cutoffs[Math.min(cutoffs.length - 1, i)]!,
      packages,
      loaded: status === "departed" ? packages : status === "loading" ? Math.round(packages * (0.4 + r() * 0.4)) : 0,
      trailer: `TR-${between(r, 100, 999)}`,
      status,
    };
  });
  const unitsPlanned = sum(appointments, (a) => a.unitsExpected);
  return {
    hubId,
    shift: "Day shift, 6:00 AM to 2:30 PM",
    unitsReceived: sum(appointments, (a) => a.unitsReceived),
    unitsPlanned,
    putawayBacklog: between(r, 1400, 4200) * scale,
    ordersToPick: sum(pickLists.filter((p) => p.status !== "picked"), (p) => p.orders),
    nextCutoff: cutoffs[0]!,
    packRate: between(r, 61, 74),
    packRateTarget: 70,
    dispatched: between(r, 2600, 5200) * scale,
    inventoryAccuracy: Math.round((99.2 + r() * 0.7) * 100) / 100,
    dockToStockHrs: Math.round((9 + r() * 14) * 10) / 10,
    returnsBacklog: between(r, 140, 620) * scale,
    appointments,
    putaway: ["A: fast movers", "B: medium", "C: bulky", "D: apparel", "S: secure cage"].map((zone) => ({ zone, totes: between(r, 6, 48), units: between(r, 180, 1400) * scale, oldestMins: between(r, 18, 240) })),
    pickLists,
    packStations,
    outbound,
    cycleCounts: ["A: fast movers", "B: medium", "C: bulky", "D: apparel", "S: secure cage"].map((zone) => {
      const bins = between(r, 400, 1800);
      const counted = Math.round(bins * (0.08 + r() * 0.12));
      return { zone, bins, counted, accuracy: Math.round((98.6 + r() * 1.35) * 100) / 100, variances: between(r, 0, 9) };
    }),
  };
}

export const fcSnapshots: FcSnapshot[] = [
  fcSnapshot("h-blr-fc", 11, 1, [["BLR-FC-01 to BLR-DH-WFD", "Whitefield Delivery Hub"], ["BLR-FC-01 to BLR-DH-HSR", "HSR Layout Delivery Hub"], ["BLR-FC-01 to CHN-DH-ADY", "Adyar Delivery Hub"], ["BLR-FC-01 to HYD-SC-01", "Medchal Sort Centre"], ["BLR-FC-01 to BLR air cargo", "Kempegowda air cargo"]]),
  fcSnapshot("h-bom-fc", 23, 1, [["BOM-FC-02 to BOM-DH-AND", "Andheri Delivery Hub"], ["BOM-FC-02 to PUN-DH-KTH", "Kothrud Delivery Hub"], ["BOM-FC-02 to BLR-DH-WFD", "Whitefield Delivery Hub"], ["BOM-FC-02 to HYD-SC-01", "Medchal Sort Centre"], ["BOM-FC-02 to KOL-SC-01", "Dankuni Sort Centre"]]),
  fcSnapshot("h-del-fc", 37, 1, [["DEL-FC-01 to DEL-DH-SKT", "Saket Delivery Hub"], ["DEL-FC-01 to HYD-SC-01", "Medchal Sort Centre"], ["DEL-FC-01 to KOL-SC-01", "Dankuni Sort Centre"], ["DEL-FC-01 to DEL air cargo", "IGI air cargo"], ["DEL-FC-01 to BOM-DH-AND", "Andheri Delivery Hub"]]),
];

/* ================================================================== */
/* Network: lanes and pincode directory                                */
/* ================================================================== */

export interface Lane {
  id: string;
  from: string;
  to: string;
  mode: "surface" | "air";
  distanceKm: number;
  transitHours: number;
  departures: string[];
  cutoff: string;
  onTimePct: number;
  loadFactor: number;
}

export const lanes: Lane[] = [
  { id: "LN-01", from: "h-blr-fc", to: "h-blr-wfd", mode: "surface", distanceKm: 24, transitHours: 1.5, departures: ["5:10 AM", "8:20 AM", "1:30 PM"], cutoff: "12:30 PM", onTimePct: 97.2, loadFactor: 84 },
  { id: "LN-02", from: "h-blr-fc", to: "h-blr-hsr", mode: "surface", distanceKm: 38, transitHours: 2, departures: ["5:30 AM", "9:00 AM", "2:00 PM"], cutoff: "1:00 PM", onTimePct: 95.8, loadFactor: 78 },
  { id: "LN-03", from: "h-blr-fc", to: "h-chn-ady", mode: "surface", distanceKm: 352, transitHours: 8, departures: ["9:00 PM"], cutoff: "7:30 PM", onTimePct: 92.4, loadFactor: 81 },
  { id: "LN-04", from: "h-hyd-sc", to: "h-blr-wfd", mode: "surface", distanceKm: 571, transitHours: 10, departures: ["3:50 AM", "7:40 PM"], cutoff: "6:00 PM", onTimePct: 89.6, loadFactor: 88 },
  { id: "LN-05", from: "h-bom-fc", to: "h-blr-wfd", mode: "surface", distanceKm: 985, transitHours: 19, departures: ["3:30 PM"], cutoff: "1:30 PM", onTimePct: 84.1, loadFactor: 91 },
  { id: "LN-06", from: "h-del-fc", to: "h-blr-wfd", mode: "air", distanceKm: 1740, transitHours: 5, departures: ["3:15 AM"], cutoff: "11:00 PM", onTimePct: 93.5, loadFactor: 72 },
  { id: "LN-07", from: "h-del-fc", to: "h-hyd-sc", mode: "surface", distanceKm: 1560, transitHours: 30, departures: ["6:00 PM"], cutoff: "4:00 PM", onTimePct: 86.9, loadFactor: 89 },
  { id: "LN-08", from: "h-bom-fc", to: "h-bom-and", mode: "surface", distanceKm: 46, transitHours: 2, departures: ["5:00 AM", "10:00 AM", "3:00 PM"], cutoff: "1:30 PM", onTimePct: 94.7, loadFactor: 93 },
  { id: "LN-09", from: "h-bom-fc", to: "h-pun-kth", mode: "surface", distanceKm: 168, transitHours: 4.5, departures: ["4:30 AM", "2:00 PM"], cutoff: "12:30 PM", onTimePct: 91.3, loadFactor: 76 },
  { id: "LN-10", from: "h-del-fc", to: "h-del-skt", mode: "surface", distanceKm: 42, transitHours: 2, departures: ["5:00 AM", "11:00 AM", "4:00 PM"], cutoff: "2:30 PM", onTimePct: 95.1, loadFactor: 90 },
  { id: "LN-11", from: "h-del-fc", to: "h-kol-sc", mode: "surface", distanceKm: 1490, transitHours: 32, departures: ["7:00 PM"], cutoff: "5:00 PM", onTimePct: 82.7, loadFactor: 85 },
  { id: "LN-12", from: "h-bom-fc", to: "h-hyd-sc", mode: "surface", distanceKm: 710, transitHours: 14, departures: ["8:00 PM"], cutoff: "6:00 PM", onTimePct: 90.2, loadFactor: 83 },
];

/** Daily inbound and outbound volume per node, used by the network page. */
export const hubThroughput: Record<string, { inbound: number; outbound: number; slaPct: number }> = {
  "h-blr-fc": { inbound: 18400, outbound: 21650, slaPct: 98.1 },
  "h-bom-fc": { inbound: 26100, outbound: 29870, slaPct: 96.4 },
  "h-del-fc": { inbound: 29800, outbound: 31240, slaPct: 95.2 },
  "h-hyd-sc": { inbound: 24300, outbound: 24120, slaPct: 97.6 },
  "h-kol-sc": { inbound: 15200, outbound: 15010, slaPct: 94.8 },
  "h-blr-wfd": { inbound: 2091, outbound: 898, slaPct: 96.9 },
  "h-blr-hsr": { inbound: 1840, outbound: 802, slaPct: 97.4 },
  "h-bom-and": { inbound: 2470, outbound: 1104, slaPct: 93.8 },
  "h-del-skt": { inbound: 2210, outbound: 970, slaPct: 95.5 },
  "h-pun-kth": { inbound: 1290, outbound: 584, slaPct: 98.3 },
  "h-chn-ady": { inbound: 1520, outbound: 671, slaPct: 96.1 },
};

export interface PincodeEntry {
  pincode: string;
  area: string;
  city: string;
  state: string;
  hubId?: string;
  cod: boolean;
  codNote?: string;
  reverse: boolean;
  heavy: boolean;
  serviceable: boolean;
}

/** Pincode master excerpt. The checker falls back to postal-circle rules for anything else. */
export const pincodeDirectory: PincodeEntry[] = [
  { pincode: "560066", area: "Whitefield", city: "Bengaluru", state: "Karnataka", hubId: "h-blr-wfd", cod: true, reverse: true, heavy: true, serviceable: true },
  { pincode: "560037", area: "Brookefield", city: "Bengaluru", state: "Karnataka", hubId: "h-blr-wfd", cod: true, reverse: true, heavy: true, serviceable: true },
  { pincode: "560048", area: "Marathahalli", city: "Bengaluru", state: "Karnataka", hubId: "h-blr-wfd", cod: true, reverse: true, heavy: true, serviceable: true },
  { pincode: "560067", area: "Kadugodi", city: "Bengaluru", state: "Karnataka", hubId: "h-blr-wfd", cod: false, codNote: "COD paused: 30-day COD RTO rate 27.4% is above the 25% limit", reverse: true, heavy: true, serviceable: true },
  { pincode: "560087", area: "Varthur", city: "Bengaluru", state: "Karnataka", hubId: "h-blr-wfd", cod: true, reverse: true, heavy: false, serviceable: true },
  { pincode: "560103", area: "Bellandur", city: "Bengaluru", state: "Karnataka", hubId: "h-blr-wfd", cod: true, reverse: true, heavy: true, serviceable: true },
  { pincode: "560016", area: "KR Puram", city: "Bengaluru", state: "Karnataka", hubId: "h-blr-wfd", cod: true, reverse: true, heavy: true, serviceable: true },
  { pincode: "560036", area: "Mahadevapura", city: "Bengaluru", state: "Karnataka", hubId: "h-blr-wfd", cod: true, reverse: true, heavy: true, serviceable: true },
  { pincode: "560102", area: "HSR Layout", city: "Bengaluru", state: "Karnataka", hubId: "h-blr-hsr", cod: true, reverse: true, heavy: true, serviceable: true },
  { pincode: "560034", area: "Koramangala", city: "Bengaluru", state: "Karnataka", hubId: "h-blr-hsr", cod: true, reverse: true, heavy: true, serviceable: true },
  { pincode: "400053", area: "Andheri West", city: "Mumbai", state: "Maharashtra", hubId: "h-bom-and", cod: true, reverse: true, heavy: true, serviceable: true },
  { pincode: "400050", area: "Bandra West", city: "Mumbai", state: "Maharashtra", hubId: "h-bom-and", cod: true, reverse: true, heavy: false, serviceable: true },
  { pincode: "411038", area: "Kothrud", city: "Pune", state: "Maharashtra", hubId: "h-pun-kth", cod: true, reverse: true, heavy: true, serviceable: true },
  { pincode: "110017", area: "Saket", city: "New Delhi", state: "Delhi", hubId: "h-del-skt", cod: true, reverse: true, heavy: true, serviceable: true },
  { pincode: "600020", area: "Adyar", city: "Chennai", state: "Tamil Nadu", hubId: "h-chn-ady", cod: true, reverse: true, heavy: true, serviceable: true },
  { pincode: "500081", area: "Madhapur", city: "Hyderabad", state: "Telangana", hubId: "h-hyd-sc", cod: true, reverse: true, heavy: true, serviceable: true },
  { pincode: "700019", area: "Ballygunge", city: "Kolkata", state: "West Bengal", hubId: "h-kol-sc", cod: true, reverse: true, heavy: false, serviceable: true },
  { pincode: "781001", area: "Pan Bazaar", city: "Guwahati", state: "Assam", cod: false, codNote: "COD unavailable in special zones", reverse: true, heavy: false, serviceable: true },
  { pincode: "190001", area: "Lal Chowk", city: "Srinagar", state: "Jammu and Kashmir", cod: false, codNote: "COD unavailable in special zones", reverse: false, heavy: false, serviceable: true },
  { pincode: "744101", area: "Port Blair", city: "Sri Vijaya Puram", state: "Andaman and Nicobar Islands", cod: false, codNote: "COD unavailable in special zones", reverse: false, heavy: false, serviceable: true },
  { pincode: "682555", area: "Kavaratti", city: "Kavaratti", state: "Lakshadweep", cod: false, codNote: "Serviceability paused for monsoon sailing schedule", reverse: false, heavy: false, serviceable: false },
];

/* ================================================================== */
/* Care Desk: agents, SLA policy, macros, articles, daily stats        */
/* ================================================================== */

export type AgentLevel = "L1" | "L2" | "Supervisor";
export type AgentPresence = "online" | "busy" | "away" | "offline";

export interface CareAgent {
  name: string;
  fullName: string;
  level: AgentLevel;
  team: string;
  presence: AgentPresence;
  activeChats: number;
  capacity: number;
  handledToday: number;
  handled7d: number;
  frtMins: number;
  ahtMins: number;
  csat: number;
  sla: number;
  qa: number;
  refundLimit: number;
  trend: number[];
}

const agentSeeds: [string, string, AgentLevel, string, AgentPresence][] = [
  ["Revathi S", "Revathi Subramanian", "L2", "Orders and delivery", "online"],
  ["Kabir Anand", "Kabir Anand", "L1", "Orders and delivery", "busy"],
  ["Megha Pillai", "Megha Pillai", "L2", "Returns and refunds", "online"],
  ["Joseph Mathew", "Joseph Mathew", "L1", "Payments", "busy"],
  ["Ayesha Siddiqui", "Ayesha Siddiqui", "L1", "Returns and refunds", "away"],
  ["Nitin Bhatt", "Nitin Bhatt", "L1", "Orders and delivery", "online"],
  ["Sana Mirza", "Sana Mirza", "L1", "Account and Plus", "online"],
  ["Rohan Pinto", "Rohan Pinto", "L2", "Escalations", "busy"],
  ["Divya Raman", "Divya Raman", "L1", "Payments", "offline"],
];

const LIMITS: Record<AgentLevel, number> = { L1: 2000, L2: 10000, Supervisor: 50000 };

export const careAgents: CareAgent[] = agentSeeds.map(([name, fullName, level, team, presence], i) => {
  const r = seeded(1200 + i);
  return {
    name,
    fullName,
    level,
    team,
    presence,
    activeChats: presence === "offline" || presence === "away" ? 0 : between(r, 0, 3),
    capacity: 3,
    handledToday: presence === "offline" ? 0 : between(r, 9, 24),
    handled7d: between(r, 140, 260),
    frtMins: Math.round((1.4 + r() * 4.2) * 10) / 10,
    ahtMins: Math.round((7 + r() * 9) * 10) / 10,
    csat: Math.round((84 + r() * 12) * 10) / 10,
    sla: Math.round((88 + r() * 11) * 10) / 10,
    qa: between(r, 78, 97),
    refundLimit: LIMITS[level],
    trend: Array.from({ length: 7 }, () => between(r, 18, 42)),
  };
});

/** The signed-in Care Desk user (matches the shell user, Revathi Subramanian). */
export const CURRENT_AGENT = careAgents[0]!;

export const SUPERVISOR = { name: "Arvind Menon", role: "Care Desk supervisor", limit: LIMITS.Supervisor };

export interface PriorityPolicy {
  code: "P1" | "P2" | "P3" | "P4";
  firstResponseMins: number;
  resolutionHours: number;
}

/** Ticket SLA policy from section 11.11 (priority maps to P1 to P4). */
export const PRIORITY_POLICY: Record<TicketPriority, PriorityPolicy> = {
  urgent: { code: "P1", firstResponseMins: 15, resolutionHours: 24 },
  high: { code: "P2", firstResponseMins: 60, resolutionHours: 48 },
  normal: { code: "P3", firstResponseMins: 240, resolutionHours: 72 },
  low: { code: "P4", firstResponseMins: 1440, resolutionHours: 168 },
};

export const ACTIVE_TICKET_STATUSES = ["open", "in_progress", "awaiting_customer", "escalated"] as const;

export function isActiveTicket(t: Ticket) {
  return (ACTIVE_TICKET_STATUSES as readonly string[]).includes(t.status);
}

export interface TicketSla {
  code: PriorityPolicy["code"];
  /** next reply due (first response or reply to the latest customer message) */
  dueAt: string;
  /** minutes until the next reply is due; negative once breached */
  minsLeft: number;
  resolutionDueAt: string;
  resolutionBreached: boolean;
  firstResponseDueAt: string;
  respondedAt?: string;
  paused: boolean;
  state: "breached" | "at_risk" | "on_track" | "paused" | "met";
}

const REPLY_WINDOW: Record<TicketPriority, [number, number]> = { urgent: [2, 24], high: [6, 90], normal: [12, 330], low: [40, 1500] };

/** Minutes since the customer's latest follow-up on an active ticket (deterministic per ticket). */
function followUpMins(t: Ticket) {
  const r = seeded(Number(t.id.replace(/\D/g, "")) || 1)();
  const [min, max] = REPLY_WINDOW[t.priority];
  return Math.round(min + r * (max - min));
}

export interface ThreadEntry {
  kind: "customer" | "agent" | "system" | "note";
  author: string;
  body: string;
  at: string;
}

const notesByCategory: Record<Ticket["category"], string> = {
  Delivery: "Checked the POD for this AWB: OTP was not used and the DA geo-tag is 380 m from the geocoded address. Raised a logistics investigation with Whitefield hub, response due in 24 hours.",
  "Return and refund": "Return was picked up with doorstep QC passed. Refund is waiting for seller QC grading at the FC. Auto-pass kicks in after 48 hours of receipt.",
  Payment: "Gateway shows the UPI payment as success after the order was abandoned at 30 minutes. Auto-refund T+1 is queued, ARN will be shared once posted.",
  "Product quality": "Customer shared 3 photos with visible crack on the display. Eligible for replacement within the 7 day window, stock available with the same seller.",
  Account: "OTP delivery logs show DND filtering on the operator route. Switched the customer to the voice OTP fallback.",
  "Seller dispute": "Seller cancelled twice citing stock mismatch. Flagged to Seller Performance for a cancellation rate review.",
  Other: "GSTIN validated on the GST portal. Business invoice can be regenerated by the seller within the same month.",
};

const followUpBody: Record<"open" | "in_progress" | "escalated", string> = {
  open: "Following up on this. Could someone please look into it?",
  in_progress: "Any update on this? I have been waiting since yesterday.",
  escalated: "It has been more than two days now. I need this resolved today or I will raise a formal complaint.",
};

/** Keeps every entry in the past (shared mock messages can land after NOW for fresh tickets). */
function clampToNow(entries: ThreadEntry[]) {
  entries.sort((a, b) => +new Date(a.at) - +new Date(b.at));
  let limit = NOW.getTime() - 2 * 60_000;
  for (let i = entries.length - 1; i >= 0; i--) {
    const at = +new Date(entries[i]!.at);
    if (at > limit) entries[i]!.at = new Date(limit).toISOString();
    limit = Math.min(at, limit) - 3 * 60_000;
  }
  return entries;
}

/** Full conversation for the agent workspace: shared messages plus internal notes and follow-ups. */
export function ticketThread(t: Ticket): ThreadEntry[] {
  const entries: ThreadEntry[] = t.messages.map((m) => ({ kind: m.from, author: m.author, body: m.body, at: m.at }));
  const created = new Date(t.createdAt).getTime();
  if (t.status !== "open") {
    entries.push({ kind: "note", author: t.assignee ?? CURRENT_AGENT.name, body: notesByCategory[t.category], at: new Date(created + 3.2 * 3600_000).toISOString() });
  }
  if (t.status === "escalated") {
    entries.push({ kind: "system", author: "AltasGoods", body: "Escalated to the L2 specialist queue: resolution SLA at risk and customer asked for escalation.", at: new Date(Math.min(created + 21 * 3600_000, NOW.getTime() - 3 * 3600_000)).toISOString() });
  }
  clampToNow(entries);
  if (t.status === "open" || t.status === "in_progress" || t.status === "escalated") {
    const lastAt = Math.max(...entries.map((e) => +new Date(e.at)));
    const at = NOW.getTime() - followUpMins(t) * 60_000;
    if (at > lastAt + 30 * 60_000) entries.push({ kind: "customer", author: t.customerName, body: followUpBody[t.status], at: new Date(at).toISOString() });
  }
  return entries.sort((a, b) => +new Date(a.at) - +new Date(b.at));
}

export function ticketSla(t: Ticket): TicketSla {
  const p = PRIORITY_POLICY[t.priority];
  const created = new Date(t.createdAt).getTime();
  const resolutionDue = created + p.resolutionHours * 3600_000;
  const thread = ticketThread(t);
  const responded = thread.find((m) => m.kind === "agent")?.at;
  const lastCustomer = [...thread].reverse().find((m) => m.kind === "customer");
  const lastCustomerAt = lastCustomer ? +new Date(lastCustomer.at) : created;
  const due = lastCustomerAt + p.firstResponseMins * 60_000;
  const minsLeft = Math.round((due - NOW.getTime()) / 60_000);
  const paused = t.status === "awaiting_customer";
  let state: TicketSla["state"];
  if (!isActiveTicket(t)) state = "met";
  else if (paused) state = "paused";
  else if (minsLeft < 0) state = "breached";
  else if (minsLeft < 60) state = "at_risk";
  else state = "on_track";
  return {
    code: p.code,
    dueAt: new Date(due).toISOString(),
    minsLeft,
    resolutionDueAt: new Date(resolutionDue).toISOString(),
    resolutionBreached: isActiveTicket(t) && NOW.getTime() > resolutionDue,
    firstResponseDueAt: new Date(created + p.firstResponseMins * 60_000).toISOString(),
    respondedAt: responded,
    paused,
    state,
  };
}

/** Customer behind a ticket (via the linked order, else by name). */
export function ticketCustomer(t: Ticket): Customer | undefined {
  const order = t.orderId ? getOrder(t.orderId) : undefined;
  return customers.find((c) => c.id === order?.customerId) ?? customers.find((c) => c.name === t.customerName);
}

export function shipmentForOrder(orderId: string) {
  return shipments.find((s) => s.orderId === orderId);
}

export interface Macro {
  id: string;
  title: string;
  category: Ticket["category"] | "General";
  body: string;
  uses: number;
  updatedAt: string;
}

export const macros: Macro[] = [
  { id: "M-101", title: "Delay apology with new date", category: "Delivery", body: "Hi {first_name}, I am sorry your order {order_id} is running late. I have checked with AltasGoods Logistics and it is now expected by {promise_date}. I will keep this ticket open and update you as soon as it is out for delivery.", uses: 1842, updatedAt: "2026-09-18" },
  { id: "M-102", title: "Marked delivered, not received", category: "Delivery", body: "Hi {first_name}, thank you for letting us know. I have opened a delivery investigation for order {order_id} with our hub team. They will verify the delivery location and proof of delivery within 24 hours. If the package is not found, we will arrange a refund or replacement.", uses: 1210, updatedAt: "2026-09-22" },
  { id: "M-103", title: "Refund timeline by payment method", category: "Return and refund", body: "Hi {first_name}, your refund for order {order_id} has been initiated. AltasGoods Credits refunds arrive in under 2 hours, UPI in 1 to 2 business days, and cards in 3 to 5 business days. You will receive the reference number by SMS once your bank confirms.", uses: 2675, updatedAt: "2026-09-29" },
  { id: "M-104", title: "Request photos of damaged item", category: "Product quality", body: "Hi {first_name}, I am sorry the item arrived damaged. Could you please reply with 2 or 3 photos of the product and the outer box, including the shipping label? This helps us arrange a replacement for order {order_id} right away.", uses: 1534, updatedAt: "2026-08-30" },
  { id: "M-105", title: "Replacement confirmed", category: "Product quality", body: "Hi {first_name}, good news: a replacement for order {order_id} has been created. Our associate will pick up the original item at the time of delivery, so please keep it ready in its packaging.", uses: 988, updatedAt: "2026-09-11" },
  { id: "M-106", title: "Payment debited, order not placed", category: "Payment", body: "Hi {first_name}, I can see the payment was debited but the order could not be confirmed. The amount will be refunded automatically to the source account within 1 business day. No action is needed from you.", uses: 1377, updatedAt: "2026-09-25" },
  { id: "M-107", title: "COD refund: bank details", category: "Return and refund", body: "Hi {first_name}, since order {order_id} was paid by cash on delivery, we can refund to your AltasGoods Credits instantly, or to a bank account or UPI ID within 1 to 2 business days after a quick verification. Please let me know which you prefer.", uses: 642, updatedAt: "2026-09-02" },
  { id: "M-108", title: "OTP not received at login", category: "Account", body: "Hi {first_name}, please try the Get OTP on call option on the login screen. If your number is on DND, SMS may be delayed by your operator. Let me know if the call OTP also does not arrive and I will help further.", uses: 721, updatedAt: "2026-07-14" },
  { id: "M-109", title: "Seller cancellation explained", category: "Seller dispute", body: "Hi {first_name}, I am sorry the seller cancelled order {order_id}. Your full refund has been initiated. I have also reported this cancellation to our seller performance team. The same item is available from other sellers on AltasGoods.", uses: 455, updatedAt: "2026-09-05" },
  { id: "M-110", title: "Escalated to specialist", category: "General", body: "Hi {first_name}, I have escalated your request to a specialist who handles cases like this. You will hear from them within 24 hours. Your ticket reference stays the same, so you do not need to explain the issue again.", uses: 803, updatedAt: "2026-09-20" },
  { id: "M-111", title: "GST invoice for business purchase", category: "Other", body: "Hi {first_name}, the seller can issue a GST invoice with your company GSTIN for order {order_id}. Please share the GSTIN and registered business name and I will request the updated invoice. It usually takes 2 business days.", uses: 312, updatedAt: "2026-06-28" },
  { id: "M-112", title: "Closing with CSAT request", category: "General", body: "Hi {first_name}, I am glad we could sort this out. I am marking this ticket as resolved. You will get a short survey about your experience, and if anything else comes up, just reply here within 7 days to reopen it. Regards, {agent_name}", uses: 3120, updatedAt: "2026-09-30" },
];

export interface ArticleSection {
  heading?: string;
  body?: string;
  bullets?: string[];
  table?: { head: string[]; rows: string[][] };
}

export interface Article {
  slug: string;
  title: string;
  category: "Returns" | "Refunds" | "Orders" | "Payments" | "Delivery" | "Membership" | "Claims";
  summary: string;
  updatedAt: string;
  owner: string;
  sections: ArticleSection[];
}

export const articles: Article[] = [
  {
    slug: "return-windows",
    title: "Return windows by category",
    category: "Returns",
    summary: "How many days a customer has to return or replace, counted from the delivery date, and what resolutions each category allows.",
    updatedAt: "2026-09-26",
    owner: "Returns policy team",
    sections: [
      { body: "Windows are counted from the delivered timestamp. Damaged, defective or wrong items can always be reported within the category window or 7 days, whichever is longer." },
      {
        table: {
          head: ["Category", "Window", "Resolutions"],
          rows: [
            ["Fashion, footwear, bags, watches", "10 days", "Refund, replacement, exchange"],
            ["Furniture and large home", "10 days", "Refund, replacement"],
            ["Home, kitchen, decor", "7 days", "Refund, replacement"],
            ["Mobiles, tablets, laptops", "7 days", "Replacement only"],
            ["Electronics and small appliances", "7 days", "Replacement only"],
            ["Large appliances", "10 days", "Replacement after technician visit"],
            ["Beauty and personal care", "7 days", "Refund if sealed, replacement if damaged"],
            ["Grocery and FMCG", "2 days", "Refund for damaged, expired or wrong"],
          ],
        },
      },
      { heading: "Non-returnable items", bullets: ["Innerwear, socks and hygiene products", "Opened consumables and personalised items", "Gift cards and digital goods"] },
    ],
  },
  {
    slug: "refund-timelines",
    title: "Refund destinations and timelines",
    category: "Refunds",
    summary: "Where refunds go for each payment method and how long each takes once the refund is processing.",
    updatedAt: "2026-09-29",
    owner: "Payments operations",
    sections: [
      {
        table: {
          head: ["Paid with", "Refund to", "Time after processing"],
          rows: [
            ["UPI", "Source UPI or AltasGoods Credits", "Credits under 2 hours, UPI 1 to 2 business days"],
            ["Credit or debit card", "Source card or AltasGoods Credits", "3 to 5 business days"],
            ["Net banking", "Source account or AltasGoods Credits", "3 to 5 business days"],
            ["EMI", "Source card (issuer reverses EMI)", "3 to 5 business days"],
            ["Cash on delivery", "AltasGoods Credits, or bank or UPI after penny drop", "Credits under 2 hours, bank 1 to 2 business days"],
            ["AltasCoins", "Restored to AltasCoins", "Instant"],
          ],
        },
      },
      { heading: "Refund at pickup", body: "Refund starts at pickup when doorstep QC passes, the item is worth up to ₹5,000, the customer risk score is low and the category is not mobiles, laptops or jewellery. Otherwise refund starts when QC passes at the seller or FC." },
    ],
  },
  {
    slug: "cancellation-policy",
    title: "Cancellation policy",
    category: "Orders",
    summary: "When customers can cancel for free, what happens after dispatch, and how seller cancellations are handled.",
    updatedAt: "2026-08-21",
    owner: "Order operations",
    sections: [
      { bullets: ["Free cancellation until the item is shipped", "After dispatch, the customer can refuse at the door or return within the window", "Seller cancellations trigger an automatic full refund and count against seller metrics", "Plus members get the same cancellation rules with faster refunds to AltasGoods Credits"] },
    ],
  },
  {
    slug: "cash-on-delivery",
    title: "Cash on delivery rules",
    category: "Payments",
    summary: "Order value limits, pincode and customer level restrictions for Pay on Delivery.",
    updatedAt: "2026-09-12",
    owner: "Payments risk",
    sections: [
      { bullets: ["Maximum order value ₹50,000", "Up to 3 undelivered COD shipments per customer at a time", "Not available for gift cards, memberships, gold or silver coins", "Disabled per pincode when the 30-day COD RTO rate exceeds 25%", "Disabled for customers with 2 or more COD refusals in 90 days, re-enabled after 3 prepaid deliveries"] },
      { heading: "At the door", body: "Customers can pay cash or scan a dynamic UPI QR on the associate's app. No COD surcharge is ever charged." },
    ],
  },
  {
    slug: "ndr-reattempts",
    title: "Failed delivery, re-attempts and RTO",
    category: "Delivery",
    summary: "What happens after a failed delivery attempt and how customers can choose a new date or update the address.",
    updatedAt: "2026-09-08",
    owner: "AltasGoods Logistics",
    sections: [
      { bullets: ["Up to 3 attempts within 5 calendar days of the first attempt", "Customer is notified within 30 minutes with options: re-attempt date, address details, alternate phone, pay online, or cancel", "No response in 24 hours: automatic re-attempt the next working day", "Refused, out of delivery area or cancelled shipments return to origin immediately"] },
      { heading: "Fake attempt reports", body: "If a customer says they were available, the case is marked disputed, gets a priority re-attempt and the associate's attempt is reviewed." },
    ],
  },
  {
    slug: "altasgoods-plus",
    title: "AltasGoods Plus benefits and billing",
    category: "Membership",
    summary: "Membership benefits, renewal, refunds on cancellation and how to check a member's status.",
    updatedAt: "2026-09-01",
    owner: "Membership team",
    sections: [
      { bullets: ["Free one-day delivery on eligible AltasGoods Fulfilled items in top cities", "Early access to AltasGoods Big Days and AltasGoods Plus Day", "Extra AltasCoins on every order", "Priority support queue with faster first response"] },
      { heading: "Cancellation", body: "Members can cancel within 14 days for a full refund if no Plus benefit was used. After that, the membership runs until the end of the paid term." },
    ],
  },
  {
    slug: "altasgoods-guarantee",
    title: "AltasGoods Guarantee claims",
    category: "Claims",
    summary: "Eligibility, filing window and decision timelines for customer protection claims against sellers.",
    updatedAt: "2026-09-17",
    owner: "Trust and Safety",
    sections: [
      { bullets: ["Item not delivered by promised date plus 3 days", "Item damaged, defective, wrong or materially different and the return was refused or the refund was not issued within 2 days of return receipt", "Customer must contact the seller or open a return and wait 48 hours first (not needed for not delivered)", "File within 90 days of the latest promised delivery date"] },
      { heading: "Decision", body: "Seller has 72 hours to respond. No response means the claim is auto-granted. AltasGoods decides within 7 days." },
    ],
  },
  {
    slug: "secure-delivery",
    title: "Secure Delivery and Open Box",
    category: "Delivery",
    summary: "How OTP delivery works for high value orders and which categories offer open box inspection at the door.",
    updatedAt: "2026-08-09",
    owner: "AltasGoods Logistics",
    sections: [
      { body: "AltasGoods Secure Delivery asks the customer to share a one-time code with the associate. The code is sent by SMS and shown in the AltasGoods app on the delivery day." },
      { bullets: ["Applies to high value orders, mobiles, laptops and jewellery", "Associates cannot mark delivered without the OTP", "Open Box lets the customer inspect the item at the door and reject it if damaged or wrong"] },
    ],
  },
];

/** Care Desk daily stats for the last 14 completed days (oldest first). */
export const careDaily = Array.from({ length: 14 }, (_, i) => {
  const r = seeded(1500 + i);
  const date = new Date(DAY_START.getTime() - (14 - i) * 86_400_000);
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const sale = date >= new Date("2026-09-26T00:00:00+05:30");
  const created = Math.round((weekend ? 1180 : 1020) * (sale ? 1.45 : 1) * (0.92 + r() * 0.16));
  const resolved = Math.round(created * (0.93 + r() * 0.1));
  return {
    date: date.toISOString(),
    created,
    resolved,
    csat: Math.round((87 + r() * 6 - (sale ? 1.6 : 0)) * 10) / 10,
    frtMins: Math.round((2.2 + r() * 1.6 + (sale ? 0.9 : 0)) * 10) / 10,
    resolutionHrs: Math.round((9 + r() * 6 + (sale ? 3 : 0)) * 10) / 10,
    sla: Math.round((93 + r() * 4.5 - (sale ? 2.1 : 0)) * 10) / 10,
    ahtMins: Math.round((9.5 + r() * 3) * 10) / 10,
  };
});

/** Today so far (10:30 AM): for overview tiles. */
export const careToday = {
  created: 486,
  resolved: 402,
  frtMins: 3.4,
  resolutionHrs: 11.6,
  sla: 94.1,
  csat: 89.2,
  chatsWaiting: 7,
  longestWaitMins: 4,
};

/** Order lines of a customer, newest first, for the Care Desk customer view. */
export function ordersForCustomer(customerId: string): Order[] {
  return orders.filter((o) => o.customerId === customerId);
}

/** A product image for any order line, used where a list needs a thumbnail. */
export function productImage(productId: string) {
  return products.find((p) => p.id === productId)?.image;
}

/** All tickets for a customer name. */
export function ticketsForCustomer(name: string) {
  return tickets.filter((t) => t.customerName === name);
}

/* ================================================================== */
/* Shipment journey: route, scans, attempts and proof of delivery      */
/* ================================================================== */

export interface ScanEvent {
  at: string;
  title: string;
  location: string;
  detail?: string;
  tone?: "success" | "warning" | "danger" | "brand" | "info" | "neutral";
}

export interface RouteNode {
  code: string;
  name: string;
  role: "Origin" | "Sort centre" | "Delivery hub" | "Customer";
  at?: string;
  state: "done" | "current" | "next";
}

export interface DeliveryAttempt {
  n: number;
  at: string;
  associateId?: string;
  outcome: "delivered" | "failed";
  reason?: NdrReason;
  geoDistanceM: number;
  called: boolean;
}

export interface ShipmentJourney {
  route: RouteNode[];
  scans: ScanEvent[];
  attempts: DeliveryAttempt[];
  beat?: Beat;
  runsheetId?: string;
  secure: boolean;
  openBox: boolean;
  phone: string;
  addressLine: string;
  landmark: string;
  dims: string;
  service: "AltasGoods Fulfilled" | "AltasGoods Ship";
  pod?: { receiver: string; otpVerified: boolean; geoDistanceM: number; at: string; method: "Cash" | "UPI QR" | "Prepaid" };
  ndr?: NdrCase;
}

const FORWARD_ORDER = ["manifested", "pickup_scheduled", "picked_up", "at_origin_hub", "in_transit", "at_destination_hub", "out_for_delivery", "delivered"] as const;
const streets = ["Lakeview Residency", "Cedar Heights", "Palm Meadows", "Silver Oak Enclave", "Riverstone Apartments", "Greenfield Towers", "Maple Court", "Sunrise Gardens"];
const landmarks = ["Opposite the BMTC depot", "Near the metro pillar 112", "Behind the Lakeside Mall service road", "Next to the petrol bunk on Main Road", "Near the Ganesha temple", "Opposite the lake park gate"];

const hubCode = (id: string) => ({ "h-bom-fc": "BOM-FC-02", "h-del-fc": "DEL-FC-01", "h-blr-fc": "BLR-FC-01", "h-hyd-sc": "HYD-SC-01", "h-kol-sc": "KOL-SC-01" })[id] ?? id;
const hubName = (id: string) =>
  ({ "h-bom-fc": "Bhiwandi Fulfilment Centre", "h-del-fc": "Farukhnagar Fulfilment Centre", "h-blr-fc": "Hoskote Fulfilment Centre", "h-hyd-sc": "Medchal Sort Centre", "h-kol-sc": "Dankuni Sort Centre" })[id] ?? id;

export function shipmentJourney(s: Shipment): ShipmentJourney {
  const r = seeded(Number(s.id.slice(3, 11)) || 7);
  const atMyHub = s.destinationHubId === CURRENT_HUB_ID;
  const beat = atMyHub ? beats.filter((b) => b.pincode === s.pincode)[between(r, 0, 1)] ?? beatForPincode(s.pincode) : undefined;
  const destName = atMyHub ? "Whitefield Delivery Hub" : s.city.split(",")[0] + " delivery hub";
  const destCode = atMyHub ? "BLR-DH-WFD" : "DH";
  const viaSort = atMyHub && (s.originHubId === "h-bom-fc" || s.originHubId === "h-del-fc") ? "h-hyd-sc" : undefined;
  const ndr = ndrCases.find((n) => n.awb === s.id);
  const runsheet = s.associateId ? runsheetFor(s.associateId) : undefined;
  const fulfilled = s.originHubId !== "h-hyd-sc";

  // stage reached on the forward path
  const status = s.status;
  const forwardIdx = (FORWARD_ORDER as readonly string[]).indexOf(status);
  const reached = status === "ndr" || status.startsWith("rto") ? 6 : status === "damaged" || status === "lost" ? 4 : forwardIdx;

  // anchor: arrival at destination hub happens early today (or yesterday for older states)
  const daysBack = status === "ndr" ? s.attempts : status.startsWith("rto") ? 3 : 0;
  const arrival = new Date(DAY_START.getTime() - daysBack * 86_400_000 + (5 * 60 + 40 + between(r, 0, 90)) * 60_000);
  const transitH = s.originHubId === "h-bom-fc" ? 19 : s.originHubId === "h-del-fc" ? (viaSort ? 30 : 6) : s.originHubId === "h-hyd-sc" ? 10 : 2;
  const departed = new Date(arrival.getTime() - transitH * 3600_000);
  const created = new Date(departed.getTime() - between(r, 3, 7) * 3600_000);
  const iso = (d: Date) => d.toISOString();
  const add = (d: Date, mins: number) => new Date(d.getTime() + mins * 60_000);
  const origin = hubName(s.originHubId);
  const originCode = hubCode(s.originHubId);
  const manifest = `MNF-${originCode.slice(0, 3)}-${iso(departed).slice(2, 10).replace(/-/g, "")}-${String(between(r, 1, 9)).padStart(2, "0")}`;

  const scans: ScanEvent[] = [];
  const push = (at: Date, title: string, location: string, detail?: string, tone?: ScanEvent["tone"]) => {
    if (at.getTime() <= NOW.getTime()) scans.push({ at: iso(at), title, location, detail, tone });
  };

  if (reached >= 0) push(created, fulfilled ? "Packed at fulfilment centre, label generated" : "Shipment created by seller, label generated", origin, `Weight ${s.weightKg} kg`);
  if (status === "pickup_scheduled") push(add(created, 40), "Pickup scheduled", origin, "Slot 4:00 pm to 6:00 pm");
  if (reached >= 2) push(add(created, 70), fulfilled ? "Handed over at FC dock" : "Picked up from seller", origin, "First carrier scan");
  if (reached >= 3) push(add(created, 110), "Bagged and manifested", origin, manifest);
  if (reached >= 4) push(departed, "Line haul departed", origin, transitH <= 6 && s.originHubId === "h-del-fc" ? "Air cargo, AWB bag sealed" : `Surface line haul, ${transitH} h transit`);
  if (reached >= 4 && viaSort) {
    const inSort = new Date(departed.getTime() + (transitH - 11) * 3600_000);
    push(inSort, "Arrived at sort centre", hubName(viaSort), "Primary sort to Bengaluru lanes");
    push(add(inSort, 160), "Departed sort centre", hubName(viaSort), "Line haul to BLR-DH-WFD");
  }
  if (reached >= 5) {
    push(arrival, "In-scanned at delivery hub", destName, "Bag debagged, shipment received");
    if (beat) push(add(arrival, 35), `Sorted to beat ${beat.code}`, destName, beat.name);
  }

  const attempts: DeliveryAttempt[] = [];
  const attemptCount = status === "delivered" ? 1 : status === "ndr" ? s.attempts : status.startsWith("rto") ? 3 : 0;
  for (let i = 0; i < attemptCount; i++) {
    const day = new Date(DAY_START.getTime() - (attemptCount - 1 - i) * 86_400_000 - (status.startsWith("rto") ? 86_400_000 : 0));
    const ofd = add(day, 8 * 60 + 40 + between(r, 0, 30));
    const isLast = i === attemptCount - 1;
    const delivered = status === "delivered" && isLast;
    let at = add(ofd, between(r, 50, 200));
    if (delivered || (status === "ndr" && isLast && ndr)) at = new Date(Math.min(at.getTime(), NOW.getTime() - between(r, 10, 60) * 60_000));
    if (status === "ndr" && isLast && ndr) at = new Date(ndr.lastAttemptAt);
    push(ofd, i === 0 ? "Out for delivery" : `Out for delivery, attempt ${i + 1}`, destName, runsheet && isLast ? `${associates.find((a) => a.id === s.associateId)?.name ?? "Associate"}, runsheet ${runsheet.id}` : undefined, "brand");
    const reason = delivered ? undefined : (ndr?.reason ?? s.ndrReason ?? "customer_unavailable");
    attempts.push({ n: i + 1, at: iso(at), associateId: s.associateId, outcome: delivered ? "delivered" : "failed", reason, geoDistanceM: ndr?.fakeAttemptFlag && isLast ? ndr.geoDistanceM : between(r, 8, 140), called: !(ndr?.fakeAttemptFlag && isLast) });
    if (delivered) push(at, "Delivered", s.city, undefined, "success");
    else {
      push(at, "Delivery attempt failed", s.city, reason ? `NDR raised: ${reason.replace(/_/g, " ")}` : undefined, "warning");
      push(add(at, 22), "Customer notified", "AltasGoods", "SMS and WhatsApp with re-attempt options");
    }
  }
  if (status === "out_for_delivery") {
    push(add(DAY_START, 8 * 60 + 40 + between(r, 0, 30)), "Out for delivery", destName, runsheet ? `${associates.find((a) => a.id === s.associateId)?.name ?? "Associate"}, runsheet ${runsheet.id}` : undefined, "brand");
  }
  if (status === "ndr" && ndr && ndr.response.at) {
    push(new Date(ndr.response.at), "Customer responded", "AltasGoods", `${ndr.response.kind.replace(/_/g, " ")}${ndr.response.note ? `: ${ndr.response.note}` : ""}`, "info");
  }
  if (status.startsWith("rto")) {
    const last = attempts.at(-1);
    const rtoAt = add(new Date(last?.at ?? arrival), 180);
    push(rtoAt, "RTO initiated", destName, "Attempts exhausted, return to origin approved", "danger");
    if (status === "rto_in_transit") push(add(rtoAt, 600), "RTO in transit", destName, `Return lane ${laneLabel(s.originHubId)}`, "danger");
  }
  if (status === "damaged") push(add(departed, 300), "Damage reported", hubName(viaSort ?? s.originHubId), "Held for inspection", "danger");

  scans.sort((a, b) => +new Date(b.at) - +new Date(a.at));

  const route: RouteNode[] = [
    { code: originCode, name: origin, role: "Origin", at: reached >= 4 ? iso(departed) : undefined, state: reached >= 4 ? "done" : "current" },
    ...(viaSort ? [{ code: hubCode(viaSort), name: hubName(viaSort), role: "Sort centre" as const, at: reached >= 5 ? iso(new Date(departed.getTime() + (transitH - 11) * 3600_000)) : undefined, state: (reached >= 5 ? "done" : reached === 4 ? "current" : "next") as RouteNode["state"] }] : []),
    { code: destCode, name: destName, role: "Delivery hub", at: reached >= 5 ? iso(arrival) : undefined, state: reached >= 6 ? "done" : reached === 5 ? "current" : "next" },
    { code: s.pincode, name: s.city.split(",")[0]!, role: "Customer", at: status === "delivered" ? attempts.at(-1)?.at : undefined, state: status === "delivered" ? "done" : reached >= 6 ? "current" : "next" },
  ];

  const order = getOrder(s.orderId);
  const value = order?.total ?? s.codAmount;
  const secure = value >= 10000 || r() < 0.12;
  const phoneSource = customers.find((c) => c.name === s.customerName)?.phone ?? `+91 9${between(r, 100000000, 999999999)}`;
  const delivered = status === "delivered" ? attempts.at(-1) : undefined;
  return {
    route,
    scans,
    attempts,
    beat,
    runsheetId: runsheet?.id,
    secure,
    openBox: !secure && r() < 0.1,
    phone: phoneSource,
    addressLine: `Flat ${between(r, 1, 9)}XX${between(r, 0, 9)}, Tower ${pick(r, ["A", "B", "C", "D", "E"])}, ${pick(r, streets)}`,
    landmark: pick(r, landmarks),
    dims: `${between(r, 18, 48)} x ${between(r, 12, 36)} x ${between(r, 6, 24)} cm`,
    service: fulfilled ? "AltasGoods Fulfilled" : "AltasGoods Ship",
    pod: delivered
      ? { receiver: pick(r, ["Self", "Self", "Family member", "Security at gate"]), otpVerified: secure || r() < 0.6, geoDistanceM: delivered.geoDistanceM, at: delivered.at, method: s.cod ? pick(r, ["Cash", "UPI QR"] as const) : "Prepaid" }
      : undefined,
    ndr,
  };
}
