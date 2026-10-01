/**
 * Demo seller applications, created through the real onboarding services
 * (sandbox GSTIN, PAN and penny drop checks, document uploads, submission
 * and staff decisions) and then back-dated, so the BluBuy Control review
 * queue shows every state with genuine check results.
 */
import { NestFactory } from "@nestjs/core";
import { eq, sql } from "drizzle-orm";
import { AppModule } from "../app.module.js";
import { DB } from "../common/tokens.js";
import { OnboardingService } from "../modules/sellers/onboarding.service.js";
import { ReviewService } from "../modules/sellers/review.service.js";
import type { Db } from "./client.js";
import { DEMO_APPLICANT_PHONE, DEMO_STAFF_PHONE } from "./demo.js";
import { samplePdf, sampleSignaturePng } from "./sample-files.js";
import { users, type Constitution, type KycDocumentKind } from "./schema.js";

interface Plan {
  phone: string;
  name: string;
  email: string;
  constitution: Constitution;
  gstin: string;
  store: string;
  description: string;
  care: string;
  grievance: string;
  pickup: { line1: string; line2?: string; city: string; state: string; pincode: string; contactName: string; contactPhone: string };
  bank: { account: string; ifsc: string };
  categories: string[];
  brand?: { brandName: string; trademark: string };
  docs: KycDocumentKind[];
  /** what happens after the wizard */
  outcome: "draft" | "review" | "changes" | "rejected";
  hoursAgo: number;
}

const PLANS: Plan[] = [
  {
    phone: "+919700011001",
    name: "Meera Kulkarni",
    email: "meera@sahyadrihome.in",
    constitution: "LLP",
    gstin: "27AAKFS4410M1ZX",
    store: "Sahyadri Home",
    description: "Handpicked cookware and home essentials from Pune, packed with care.",
    care: "+91 20 4012 8821",
    grievance: "Meera Kulkarni, grievance@sahyadrihome.in",
    pickup: { line1: "Plot 12, Sector 7", line2: "Bhosari MIDC", city: "Pune", state: "Maharashtra", pincode: "411026", contactName: "Ravi Patil", contactPhone: "9822011834" },
    bank: { account: "50200041234821", ifsc: "HDFC0001234" },
    categories: ["cat-home", "cat-appliances"],
    brand: { brandName: "Sahyadri Home", trademark: "5281934" },
    docs: ["SIGNATURE", "LLP_CERTIFICATE", "ADDRESS_PROOF", "TRADEMARK"],
    outcome: "review",
    hoursAgo: 20,
  },
  {
    phone: "+919700011002",
    name: "",
    email: "accounts@bhatelectronics.in",
    constitution: "PROPRIETORSHIP",
    gstin: "29ABCPB4821K1ZS",
    store: "Bhat Electronics Hub",
    description: "Audio, chargers and smart home gear from Bengaluru with same day dispatch.",
    care: "+91 80 4110 2290",
    grievance: "Grievance desk, care@bhatelectronics.in",
    pickup: { line1: "No. 48, 5th Main", line2: "Koramangala 4th Block", city: "Bengaluru", state: "Karnataka", pincode: "560034", contactName: "Store manager", contactPhone: "9845123456" },
    bank: { account: "918020055212222", ifsc: "UTIB0000123" },
    categories: ["cat-electronics", "cat-mobiles"],
    docs: ["SIGNATURE", "ID_PROOF", "ADDRESS_PROOF", "BANK_PROOF"],
    outcome: "review",
    hoursAgo: 50,
  },
  {
    phone: "+919700011003",
    name: "Nithya Raman",
    email: "nithya@nilgirifoods.in",
    constitution: "PRIVATE_LIMITED",
    gstin: "33AAJCN5521H1ZL",
    store: "Nilgiri Pantry",
    description: "Tea, spices and millets sourced from the Nilgiris.",
    care: "+91 44 4920 1180",
    grievance: "Nithya Raman, grievance@nilgirifoods.in",
    pickup: { line1: "22, Industrial Estate", line2: "Guindy", city: "Chennai", state: "Tamil Nadu", pincode: "600032", contactName: "Dispatch desk", contactPhone: "9840012345" },
    // same account as Sahyadri Home, so screening raises a high severity flag
    bank: { account: "50200041234821", ifsc: "HDFC0001234" },
    categories: ["cat-grocery"],
    docs: ["SIGNATURE", "INCORPORATION_CERTIFICATE", "ADDRESS_PROOF"],
    outcome: "review",
    hoursAgo: 8,
  },
  {
    phone: DEMO_APPLICANT_PHONE,
    name: "Lakshmi Nair",
    email: "lakshmi@malabarspice.in",
    constitution: "LLP",
    gstin: "32AALFM7310D1ZP",
    store: "Malabar Spice Route",
    description: "Single origin pepper, cardamom and coffee from Kerala estates.",
    care: "+91 484 401 2276",
    grievance: "Lakshmi Nair, grievance@malabarspice.in",
    pickup: { line1: "Building 9, KINFRA Park", line2: "Kalamassery", city: "Kochi", state: "Kerala", pincode: "683503", contactName: "Lakshmi Nair", contactPhone: "9847012345" },
    bank: { account: "10023456789012", ifsc: "FDRL0001021" },
    categories: ["cat-grocery", "cat-home"],
    docs: ["SIGNATURE", "LLP_CERTIFICATE", "ADDRESS_PROOF"],
    outcome: "changes",
    hoursAgo: 70,
  },
  {
    phone: "+919700011005",
    name: "",
    email: "rohit@vermasports.in",
    constitution: "PROPRIETORSHIP",
    gstin: "09AAWPV2290R1ZB",
    store: "Verma Sports Arena",
    description: "Cricket and fitness gear from Meerut.",
    care: "+91 121 400 8812",
    grievance: "Rohit Verma, help@vermasports.in",
    pickup: { line1: "Shop 4, Sports Goods Market", city: "Meerut", state: "Uttar Pradesh", pincode: "250002", contactName: "Rohit Verma", contactPhone: "9837012345" },
    bank: { account: "33445566778899", ifsc: "SBIN0001234" },
    categories: ["cat-sports"],
    docs: [],
    outcome: "draft",
    hoursAgo: 3,
  },
  {
    phone: "+919700011006",
    name: "",
    email: "sneha@desaicelebrations.in",
    constitution: "PROPRIETORSHIP",
    gstin: "24AADPD6612M1ZW",
    store: "Desai Celebrations",
    description: "Festive decor and fireworks for Diwali.",
    care: "+91 79 4002 7711",
    grievance: "Sneha Desai, grievance@desaicelebrations.in",
    pickup: { line1: "17, Relief Road", city: "Ahmedabad", state: "Gujarat", pincode: "380001", contactName: "Sneha Desai", contactPhone: "9825012345" },
    bank: { account: "77889900112233", ifsc: "BARB0RELIEF" },
    categories: ["cat-toys", "cat-home"],
    docs: ["SIGNATURE", "ID_PROOF", "ADDRESS_PROOF"],
    outcome: "rejected",
    hoursAgo: 6 * 24,
  },
];

/** Moves an application's whole history back in time. */
async function backdate(db: Db, id: string, hours: number) {
  const iv = `${hours} hours`;
  await db.execute(sql`update seller_applications set created_at = created_at - ${iv}::interval, updated_at = updated_at - ${iv}::interval,
    submitted_at = submitted_at - ${iv}::interval, sla_due_at = sla_due_at - ${iv}::interval, decided_at = decided_at - ${iv}::interval where id = ${id}`);
  await db.execute(sql`update seller_application_events set at = at - ${iv}::interval where application_id = ${id}`);
  await db.execute(sql`update kyc_documents set uploaded_at = uploaded_at - ${iv}::interval, reviewed_at = reviewed_at - ${iv}::interval where application_id = ${id}`);
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

export async function seedApplications() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const db = app.get<Db>(DB);
  const onboarding = app.get(OnboardingService);
  const review = app.get(ReviewService);
  const [staff] = await db.select({ id: users.id }).from(users).where(eq(users.phone, DEMO_STAFF_PHONE));
  let created = 0;

  for (const p of PLANS) {
    const [user] = await db
      .insert(users)
      .values({ phone: p.phone, name: p.name || null, email: p.email, emailVerifiedAt: new Date() })
      .returning({ id: users.id });
    const userId = user!.id;
    const { view } = await onboarding.start(userId);
    await onboarding.update(userId, { constitution: p.constitution });
    const afterGst = await onboarding.verifyGstin(userId, p.gstin);
    // a proprietor's legal name is their own name
    if (p.constitution === "PROPRIETORSHIP") await db.update(users).set({ name: titleCase(afterGst.business.legalName ?? "Seller") }).where(eq(users.id, userId));
    await onboarding.update(userId, { storeName: p.store, storeDescription: p.description, careNumber: p.care, grievanceContact: p.grievance });
    created++;
    if (p.outcome === "draft") {
      await backdate(db, view.id, p.hoursAgo);
      continue;
    }

    await onboarding.update(userId, {
      pickup: { ...p.pickup, slot: "4:00 to 6:00 PM" },
      categories: p.categories,
      brand: p.brand ? { ownBrand: true, ...p.brand, trademarkClass: "21", reseller: false } : { ownBrand: false, reseller: true },
    });
    await onboarding.verifyBank(userId, { holder: afterGst.business.legalName ?? p.store, ...p.bank });
    for (const kind of p.docs) {
      const buffer = kind === "SIGNATURE" ? sampleSignaturePng(p.store) : samplePdf(`${p.store}: ${kind.replace(/_/g, " ").toLowerCase()}`, ["Sample document generated for the BluBuy demo.", `Application for ${p.store}.`]);
      await onboarding.upload(userId, kind, { originalname: kind === "SIGNATURE" ? "signature.png" : `${kind.toLowerCase().replace(/_/g, "-")}.pdf`, buffer, size: buffer.length });
    }
    await onboarding.submit(userId);

    if (p.outcome === "changes") {
      await backdate(db, view.id, p.hoursAgo - 40);
      await review.requestChanges(staff!.id, view.id, {
        items: ["ADDRESS_PROOF"],
        message: "The electricity bill you uploaded is from May 2026. Upload a bill or rent agreement from the last 3 months.",
      });
      await backdate(db, view.id, 40);
    } else if (p.outcome === "rejected") {
      await backdate(db, view.id, p.hoursAgo - 5 * 24);
      await review.reject(staff!.id, view.id, {
        reason: "Prohibited business category",
        note: "Fireworks are restricted goods under the Explosives Rules; the store description lists them as the main product.",
      });
      await backdate(db, view.id, 5 * 24);
    } else {
      await backdate(db, view.id, p.hoursAgo);
    }
  }

  await app.close();
  return created;
}
