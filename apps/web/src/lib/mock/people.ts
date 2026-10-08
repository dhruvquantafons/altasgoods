import type { Address, Customer, Seller, StaffMember } from "../types";
import type { SellerStatus } from "../status";
import { addDays, between, NOW, pick, seeded } from "../utils";

/* ------------------------------- Sellers ------------------------------ */

type SellerSeed = [
  id: string,
  displayName: string,
  legalName: string,
  owner: string,
  city: string,
  state: string,
  pincode: string,
  status: SellerStatus,
  tier: Seller["tier"],
  cats: string[],
];

const sellerSeeds: SellerSeed[] = [
  ["s-apex", "Apex Retail", "Apex Retail Private Limited", "Rohan Mehta", "Mumbai", "Maharashtra", "400072", "active", "Platinum", ["electronics", "mobiles", "appliances", "home"]],
  ["s-novatek", "Novatek Official Store", "Novatek India Private Limited", "Kavya Iyer", "Bengaluru", "Karnataka", "560103", "active", "Platinum", ["mobiles"]],
  ["s-urbankart", "UrbanKart Trading Co.", "UrbanKart Trading Company LLP", "Aditya Khanna", "New Delhi", "Delhi", "110020", "active", "Gold", ["electronics", "fashion", "mobiles"]],
  ["s-ganesh", "Shree Ganesh Traders", "Shree Ganesh Traders", "Mahesh Patel", "Ahmedabad", "Gujarat", "380015", "active", "Silver", ["appliances", "grocery", "electronics"]],
  ["s-loomhouse", "Loom House Fashions", "Loom House Fashions Private Limited", "Priya Rathore", "Jaipur", "Rajasthan", "302001", "active", "Gold", ["fashion"]],
  ["s-terra", "Terra Living", "Terra Living Homeware LLP", "Neha Kulkarni", "Pune", "Maharashtra", "411014", "active", "Gold", ["home"]],
  ["s-kiln", "Kiln & Co Studio", "Kiln and Co Crafts", "Arjun Sethi", "Noida", "Uttar Pradesh", "201301", "active", "Silver", ["home"]],
  ["s-greenleaf", "GreenLeaf Organics", "GreenLeaf Organics Private Limited", "Thomas Varghese", "Kochi", "Kerala", "682024", "active", "Silver", ["grocery", "beauty"]],
  ["s-pageturn", "PageTurn Books", "PageTurn Book Distributors", "Sourav Banerjee", "Kolkata", "West Bengal", "700016", "active", "Bronze", ["books"]],
  ["s-profit", "ProFit Sports", "ProFit Sports Goods", "Harpreet Singh", "Meerut", "Uttar Pradesh", "250001", "on_hold", "Silver", ["sports", "fashion"]],
  ["s-glow", "Glow Beauty Hub", "Glow Beauty Hub Private Limited", "Sana Qureshi", "Hyderabad", "Telangana", "500081", "active", "Gold", ["beauty"]],
  ["s-tinytots", "TinyTots World", "TinyTots World Retail", "Lakshmi Narayanan", "Chennai", "Tamil Nadu", "600017", "active", "Bronze", ["toys"]],
  ["s-vastra", "Vastra Weaves", "Vastra Weaves Handloom Co.", "Meera Joshi", "Varanasi", "Uttar Pradesh", "221001", "under_review", "Bronze", ["fashion"]],
  ["s-kitchenkraft", "Kitchen Kraft India", "Kitchen Kraft India Private Limited", "Vikram Reddy", "Hyderabad", "Telangana", "500032", "documents_submitted", "Bronze", ["home", "appliances"]],
  ["s-bytezone", "ByteZone Electronics", "ByteZone Electronics", "Imran Shaikh", "Pune", "Maharashtra", "411001", "action_required", "Bronze", ["electronics"]],
  ["s-desihandloom", "Desi Handloom Co.", "Desi Handloom Company", "Gopal Das", "Surat", "Gujarat", "395003", "suspended", "Bronze", ["fashion"]],
  ["s-petpals", "PetPals Supplies", "PetPals Supplies LLP", "Ritika Arora", "Gurugram", "Haryana", "122002", "registration_started", "Bronze", ["home"]],
  ["s-ayurveda", "Ayurveda Roots", "Ayurveda Roots Wellness", "Dr. Anil Menon", "Thrissur", "Kerala", "680001", "under_review", "Bronze", ["beauty", "grocery"]],
];

const stateCodes: Record<string, string> = {
  Maharashtra: "27", Karnataka: "29", Delhi: "07", Gujarat: "24", Rajasthan: "08", "Uttar Pradesh": "09",
  Kerala: "32", "West Bengal": "19", Telangana: "36", "Tamil Nadu": "33", Haryana: "06",
};

export const sellers: Seller[] = sellerSeeds.map(([id, displayName, legalName, owner, city, state, pincode, status, tier, cats], i) => {
  const rand = seeded(500 + i);
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const pan = `${Array.from({ length: 5 }, () => pick(rand, letters.split(""))).join("")}${between(rand, 1000, 9999)}${pick(rand, letters.split(""))}`;
  const active = status === "active" || status === "on_hold";
  const scale = tier === "Platinum" ? 9 : tier === "Gold" ? 4 : tier === "Silver" ? 2 : 1;
  return {
    id,
    slug: id.replace(/^s-/, ""),
    displayName,
    legalName,
    ownerName: owner,
    email: `${owner.split(" ")[0]!.toLowerCase().replace(/\W/g, "")}@${id.replace(/^s-/, "")}.in`,
    phone: `+91 9${between(rand, 100000000, 999999999)}`,
    gstin: `${stateCodes[state] ?? "27"}${pan}1Z${between(rand, 1, 9)}`,
    pan,
    city,
    state,
    pincode,
    joinedAt: addDays(NOW, active ? -between(rand, 120, 1400) : -between(rand, 1, 12)).toISOString(),
    status,
    tier,
    rating: active ? Math.round((3.9 + rand() * 0.9) * 10) / 10 : 0,
    ratingCount: active ? between(rand, 800, 40000) * scale : 0,
    categories: cats.map((c) => `cat-${c}`),
    liveListings: active ? between(rand, 40, 260) * scale : 0,
    gmv30d: active ? between(rand, 900000, 4200000) * scale : 0,
    orders30d: active ? between(rand, 600, 2600) * scale : 0,
    fulfillment: tier === "Platinum" ? ["blubuy_fulfilled", "easy_ship"] : tier === "Bronze" ? ["self_ship"] : ["easy_ship", "blubuy_fulfilled"],
    health: {
      odr: id === "s-profit" ? 1.4 : Math.round(rand() * 80) / 100,
      cancellationRate: id === "s-profit" ? 3.1 : Math.round(rand() * 200) / 100,
      lateDispatchRate: Math.round(rand() * 350) / 100,
      validTrackingRate: Math.round((96 + rand() * 4) * 10) / 10,
      returnRate: Math.round((2 + rand() * 7) * 10) / 10,
      policyViolations: id === "s-profit" ? 2 : rand() > 0.8 ? 1 : 0,
      score: id === "s-profit" ? 610 : between(rand, 780, 990),
    },
  };
});

/** The seller account used in the Seller Central demo. */
export const CURRENT_SELLER_ID = "s-apex";

export function getSeller(id: string) {
  return sellers.find((s) => s.id === id || s.slug === id);
}

/* ------------------------------ Customers ----------------------------- */

const first = ["Ananya", "Rahul", "Ishita", "Vivek", "Sneha", "Arjun", "Pooja", "Karan", "Divya", "Siddharth", "Meera", "Aman", "Nisha", "Rohit", "Tanvi", "Farhan", "Kavitha", "Manish", "Aisha", "Varun", "Simran", "Deepak", "Lavanya", "Nikhil", "Zoya", "Abhishek", "Shreya", "Gaurav", "Priyanka", "Yash"];
const last = ["Sharma", "Verma", "Iyer", "Nair", "Reddy", "Kapoor", "Gupta", "Das", "Menon", "Joshi", "Bose", "Malhotra", "Pillai", "Chopra", "Rao", "Khan", "Saxena", "Mishra", "Agarwal", "Singh"];
const places: [string, string, string][] = [
  ["Bengaluru", "Karnataka", "560034"], ["Mumbai", "Maharashtra", "400050"], ["New Delhi", "Delhi", "110017"],
  ["Hyderabad", "Telangana", "500033"], ["Chennai", "Tamil Nadu", "600020"], ["Pune", "Maharashtra", "411038"],
  ["Kolkata", "West Bengal", "700019"], ["Ahmedabad", "Gujarat", "380009"], ["Jaipur", "Rajasthan", "302017"],
  ["Lucknow", "Uttar Pradesh", "226010"], ["Kochi", "Kerala", "682020"], ["Chandigarh", "Chandigarh", "160017"],
  ["Indore", "Madhya Pradesh", "452010"], ["Gurugram", "Haryana", "122018"], ["Bhubaneswar", "Odisha", "751007"],
];

export const customers: Customer[] = Array.from({ length: 60 }, (_, i) => {
  const rand = seeded(9000 + i);
  const name = i === 0 ? "Ananya Sharma" : `${first[i % first.length]} ${last[(i * 7) % last.length]}`;
  const [city, state] = i === 0 ? places[0]! : pick(rand, places);
  const orders = i === 0 ? 34 : between(rand, 1, 48);
  const risk = i % 17 === 5 ? between(rand, 70, 95) : between(rand, 2, 40);
  return {
    id: `c-${String(i + 1).padStart(3, "0")}`,
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@${pick(rand, ["gmail.com", "outlook.com", "yahoo.in", "proton.me"])}`,
    phone: `+91 ${pick(rand, ["98", "99", "97", "88", "70", "63"])}${between(rand, 10000000, 99999999)}`,
    city,
    state,
    joinedAt: addDays(NOW, -between(rand, 10, 1900)).toISOString(),
    orders,
    lifetimeValue: orders * between(rand, 900, 6400),
    plusMember: i === 0 || rand() > 0.62,
    bluCoins: between(rand, 0, 2400),
    status: risk > 80 ? "flagged" : i % 29 === 13 ? "blocked" : "active",
    riskScore: risk,
    // the demo shopper: a long-time member whose phone matches her saved addresses
    ...(i === 0 ? { phone: "+91 98450 12345", joinedAt: "2021-03-14T09:12:00+05:30" } : {}),
  };
});

/** The signed-in shopper used across the storefront and account demo. */
export const CURRENT_CUSTOMER = customers[0]!;

export const customerAddresses: Address[] = [
  { id: "addr-1", name: "Ananya Sharma", phone: "+91 98450 12345", line1: "Flat 1204, Tower B, Lakeview Residency", line2: "Varthur Main Road, Whitefield", landmark: "Near Gunjur Lake", city: "Bengaluru", state: "Karnataka", pincode: "560087", type: "home", isDefault: true },
  { id: "addr-2", name: "Ananya Sharma", phone: "+91 98450 12345", line1: "4th Floor, Orion Tech Park", line2: "Outer Ring Road, Kadubeesanahalli", city: "Bengaluru", state: "Karnataka", pincode: "560103", type: "work" },
  { id: "addr-3", name: "Sunita Sharma", phone: "+91 99100 54321", line1: "B-42, Greater Kailash Part 1", city: "New Delhi", state: "Delhi", pincode: "110048", type: "other" },
];

/* -------------------------------- Staff ------------------------------- */

export const staff: StaffMember[] = [
  { id: "u-1", name: "Rawahul Islam", email: "rawahul@altasgoods.in", role: "Super Admin", team: "Leadership", lastActive: addDays(NOW, 0).toISOString(), status: "active" },
  { id: "u-2", name: "Aparna Krishnan", email: "aparna@altasgoods.in", role: "Catalog Manager", team: "Catalog", lastActive: addDays(NOW, 0).toISOString(), status: "active" },
  { id: "u-3", name: "Dev Malhotra", email: "dev@altasgoods.in", role: "Seller Onboarding Lead", team: "Seller Success", lastActive: addDays(NOW, -1).toISOString(), status: "active" },
  { id: "u-4", name: "Fatima Sheikh", email: "fatima@altasgoods.in", role: "Finance Controller", team: "Finance", lastActive: addDays(NOW, 0).toISOString(), status: "active" },
  { id: "u-5", name: "Kunal Bhatia", email: "kunal@altasgoods.in", role: "Marketing Manager", team: "Growth", lastActive: addDays(NOW, -2).toISOString(), status: "active" },
  { id: "u-6", name: "Revathi Subramanian", email: "revathi@altasgoods.in", role: "Support Team Lead", team: "Customer Experience", lastActive: addDays(NOW, 0).toISOString(), status: "active" },
  { id: "u-7", name: "Manoj Tiwari", email: "manoj@altasgoods.in", role: "Logistics Manager", team: "Operations", lastActive: addDays(NOW, -1).toISOString(), status: "active" },
  { id: "u-8", name: "Elena D'Souza", email: "elena@altasgoods.in", role: "Risk Analyst", team: "Trust and Safety", lastActive: addDays(NOW, -3).toISOString(), status: "active" },
  { id: "u-9", name: "Harsh Vardhan", email: "harsh@altasgoods.in", role: "Catalog Associate", team: "Catalog", lastActive: addDays(NOW, -12).toISOString(), status: "invited" },
  { id: "u-10", name: "Nikita Rao", email: "nikita@altasgoods.in", role: "Support Agent", team: "Customer Experience", lastActive: addDays(NOW, -40).toISOString(), status: "disabled" },
];
