import type { DeliveryAssociate, Hub, Shipment } from "../types";
import type { NdrReason, ShipmentStatus } from "../status";
import { addDays, between, istHour, istMinuteOfDay, NOW, pick, seeded } from "../utils";
import { orders } from "./orders";
import { sellers } from "./people";

export const hubs: Hub[] = [
  { id: "h-blr-fc", code: "BLR-FC-01", name: "Hoskote Fulfilment Centre", type: "fulfillment_center", city: "Bengaluru", capacity: 42000, utilisation: 81, manager: "Suresh Gowda" },
  { id: "h-bom-fc", code: "BOM-FC-02", name: "Bhiwandi Fulfilment Centre", type: "fulfillment_center", city: "Mumbai", capacity: 56000, utilisation: 88, manager: "Pradeep Jadhav" },
  { id: "h-del-fc", code: "DEL-FC-01", name: "Farukhnagar Fulfilment Centre", type: "fulfillment_center", city: "Gurugram", capacity: 61000, utilisation: 92, manager: "Ravinder Yadav" },
  { id: "h-hyd-sc", code: "HYD-SC-01", name: "Medchal Sort Centre", type: "sort_center", city: "Hyderabad", capacity: 38000, utilisation: 74, manager: "Srinivas Rao" },
  { id: "h-kol-sc", code: "KOL-SC-01", name: "Dankuni Sort Centre", type: "sort_center", city: "Kolkata", capacity: 30000, utilisation: 66, manager: "Arindam Ghosh" },
  { id: "h-blr-wfd", code: "BLR-DH-WFD", name: "Whitefield Delivery Hub", type: "delivery_hub", city: "Bengaluru", capacity: 4800, utilisation: 86, manager: "Naveen Kumar" },
  { id: "h-blr-hsr", code: "BLR-DH-HSR", name: "HSR Layout Delivery Hub", type: "delivery_hub", city: "Bengaluru", capacity: 4200, utilisation: 79, manager: "Shalini Rao" },
  { id: "h-bom-and", code: "BOM-DH-AND", name: "Andheri Delivery Hub", type: "delivery_hub", city: "Mumbai", capacity: 5200, utilisation: 91, manager: "Sameer Khan" },
  { id: "h-del-skt", code: "DEL-DH-SKT", name: "Saket Delivery Hub", type: "delivery_hub", city: "New Delhi", capacity: 5000, utilisation: 83, manager: "Pankaj Sharma" },
  { id: "h-pun-kth", code: "PUN-DH-KTH", name: "Kothrud Delivery Hub", type: "delivery_hub", city: "Pune", capacity: 3600, utilisation: 64, manager: "Ajay Deshmukh" },
  { id: "h-chn-ady", code: "CHN-DH-ADY", name: "Adyar Delivery Hub", type: "delivery_hub", city: "Chennai", capacity: 3900, utilisation: 72, manager: "Karthik Subramaniam" },
];

/** The hub whose console the logistics demo shows. */
export const CURRENT_HUB_ID = "h-blr-wfd";

const daNames = ["Ravi Kumar", "Manjunath S", "Imran Pasha", "Prakash Naik", "Venkatesh B", "Santosh Gowda", "Abdul Rahman", "Mohan Raj", "Kiran Shetty", "Sunil Yadav", "Arun Prasad", "Faizal Khan", "Chandru M", "Raghu N", "Deepak Hegde", "Yusuf Ali", "Lokesh R", "Vinay Kumar"];

const dr = seeded(314);

export const associates: DeliveryAssociate[] = daNames.map((name, i) => {
  const status = (["on_route", "on_route", "on_route", "available", "on_route", "on_break", "on_route", "off_duty"] as const)[i % 8];
  const assigned = status === "off_duty" ? 0 : between(dr, 18, 34);
  const delivered = status === "off_duty" ? 0 : Math.round(assigned * (0.35 + dr() * 0.5));
  const failed = status === "off_duty" ? 0 : between(dr, 0, 3);
  return {
    id: `da-${i + 1}`,
    name,
    phone: `+91 9${between(dr, 100000000, 999999999)}`,
    hubId: i < 14 ? CURRENT_HUB_ID : "h-blr-hsr",
    vehicle: pick(dr, ["bike", "bike", "scooter", "ev", "van"] as const),
    status,
    assigned,
    delivered,
    failed,
    codCollected: delivered * between(dr, 300, 1400),
    rating: Math.round((4.3 + dr() * 0.7) * 10) / 10,
  };
});

const statusWeights: [ShipmentStatus, number][] = [
  ["at_destination_hub", 0.14], ["out_for_delivery", 0.3], ["delivered", 0.3], ["ndr", 0.08],
  ["rto_initiated", 0.03], ["in_transit", 0.08], ["picked_up", 0.03], ["pickup_scheduled", 0.02], ["rto_in_transit", 0.01], ["damaged", 0.01],
];

function pickStatus(): ShipmentStatus {
  let r = dr();
  for (const [s, w] of statusWeights) if ((r -= w) <= 0) return s;
  return "delivered";
}

const ndrReasons: NdrReason[] = ["customer_unavailable", "address_incomplete", "customer_refused", "cod_not_ready", "reschedule_requested", "premises_closed"];
const blrPincodes = ["560066", "560037", "560048", "560067", "560087", "560103", "560016", "560036"];
const blrLocalities = ["Whitefield", "Brookefield", "Marathahalli", "Kadugodi", "Varthur", "Bellandur", "KR Puram", "Mahadevapura"];

/** Shipments flowing through the logistics network, weighted to the current hub. */
export const shipments: Shipment[] = Array.from({ length: 160 }, (_, i) => {
  const order = orders[i % orders.length]!;
  const status = pickStatus();
  const atMyHub = i % 5 !== 4;
  const cod = order.payment.method === "cod" || dr() < 0.15;
  const destinationHubId = atMyHub ? CURRENT_HUB_ID : pick(dr, ["h-bom-and", "h-del-skt", "h-pun-kth", "h-chn-ady", "h-blr-hsr"]);
  const onRoute = associates.filter((a) => (a.status === "on_route" || a.status === "available") && a.hubId === destinationHubId);
  const li = between(dr, 0, blrLocalities.length - 1);
  return {
    id: `BBL${between(dr, 1000000000, 9999999999)}`,
    orderId: order.id,
    sellerId: order.items[0]!.sellerId,
    customerName: order.customerName,
    city: atMyHub ? `${blrLocalities[li]}, Bengaluru` : order.address.city,
    pincode: atMyHub ? blrPincodes[li]! : order.address.pincode,
    originHubId: pick(dr, ["h-bom-fc", "h-del-fc", "h-blr-fc", "h-hyd-sc"]),
    destinationHubId,
    status,
    weightKg: Math.round((0.2 + dr() * 6) * 10) / 10,
    cod,
    codAmount: cod ? order.total : 0,
    promisedBy: addDays(NOW, between(dr, 0, 2)).toISOString(),
    attempts: status === "ndr" ? between(dr, 1, 2) : status.startsWith("rto") ? 3 : status === "delivered" ? 1 : 0,
    ndrReason: status === "ndr" || status.startsWith("rto") ? pick(dr, ndrReasons) : undefined,
    associateId: ["out_for_delivery", "delivered", "ndr"].includes(status) && onRoute.length ? pick(dr, onRoute).id : undefined,
    lastUpdate: new Date(NOW.getTime() - between(dr, 5, 600) * 60_000).toISOString(),
  };
});

export function getHub(id: string) {
  return hubs.find((h) => h.id === id);
}

export function sellerName(id: string) {
  return sellers.find((s) => s.id === id)?.displayName ?? id;
}

/** Deliveries completed per hour today at the current hub (8 AM to 9 PM). */
export const hourlyDeliveries = Array.from({ length: 14 }, (_, i) => {
  const hour = 8 + i;
  const r = seeded(hour)();
  const shape = Math.sin(((hour - 8) / 13) * Math.PI);
  // completed hours are full; the running hour (10 AM at 10:30) holds only what is delivered so far
  const full = Math.round(18 + shape * 70 + r * 10);
  const nowHour = istHour(NOW);
  const done = hour < nowHour ? full : hour === nowHour ? Math.round((full * (istMinuteOfDay(NOW) % 60)) / 60) : 0;
  return { hour: `${hour > 12 ? hour - 12 : hour} ${hour >= 12 ? "PM" : "AM"}`, delivered: done, planned: Math.round(20 + shape * 75) };
});
