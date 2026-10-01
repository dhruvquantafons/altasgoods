import { eq } from "drizzle-orm";
import { decodeJwt } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { createDb } from "../src/db/client.js";
import { samplePdf, sampleSignaturePng } from "../src/db/sample-files.js";
import { sellers, users } from "../src/db/schema.js";
import { gstinCheckChar } from "../src/modules/sellers/kyc/india.js";
import { createTestApp, DEMO_CUSTOMER, DEMO_STAFF, signIn, type TestContext } from "./helpers.js";

let t: TestContext;
let staff: Record<string, string>;
const { db, pool } = createDb(env().TEST_DATABASE_URL);
const BASE = "/v1/me/seller-application";
const PICKUP = { line1: "Plot 12, Sector 7", line2: "Bhosari MIDC", city: "Pune", state: "Maharashtra", pincode: "411026", contactName: "Ravi Patil", contactPhone: "9822011834", slot: "4:00 to 6:00 PM" };
const gstinFor = (state: string, pan: string) => `${state}${pan}1Z${gstinCheckChar(`${state}${pan}1Z`)}`;

beforeAll(async () => {
  t = await createTestApp();
  staff = (await signIn(t.http, DEMO_STAFF)).auth;
});
afterAll(async () => {
  await t.close();
  await pool.end();
});
beforeEach(() => t.clock.reset());

async function verifyEmail(auth: Record<string, string>, email: string) {
  const otp = await t.http.post("/v1/me/email/otp").set(auth).send({ email }).expect(200);
  await t.http.post("/v1/me/email/verify").set(auth).send({ code: otp.body.devCode }).expect(200);
}

function upload(auth: Record<string, string>, kind: string, name = kind === "SIGNATURE" ? "signature.png" : "doc.pdf") {
  const buffer = kind === "SIGNATURE" ? sampleSignaturePng(kind) : samplePdf(kind);
  return t.http.post(`${BASE}/documents`).set(auth).field("kind", kind).attach("file", buffer, name);
}

/** A complete application, ready to submit. */
async function prepare(phone: string, o: { name: string; gstin: string; store: string; account: string; constitution?: string }) {
  const { auth, session } = await signIn(t.http, phone, o.name);
  await t.http.post(BASE).set(auth).expect(201);
  await verifyEmail(auth, `${phone}@example.in`);
  await t.http.patch(BASE).set(auth).send({ constitution: o.constitution ?? "LLP" }).expect(200);
  await t.http.post(`${BASE}/verify/gstin`).set(auth).send({ gstin: o.gstin }).expect(200);
  await t.http
    .patch(BASE)
    .set(auth)
    .send({ storeName: o.store, careNumber: "+91 20 4012 8821", grievanceContact: `${o.name}, grievance@example.in`, pickup: PICKUP, categories: ["cat-home"], brand: { ownBrand: false, reseller: true } })
    .expect(200);
  const bank = await t.http.post(`${BASE}/verify/bank`).set(auth).send({ holder: o.store, account: o.account, ifsc: "HDFC0001234" }).expect(200);
  for (const d of bank.body.requiredDocuments.filter((d: { required: boolean }) => d.required)) await upload(auth, d.kind).expect(201);
  return { auth, session };
}

describe("seller onboarding", () => {
  it("runs from sign up to an approved seller account", async () => {
    const { auth, session } = await signIn(t.http, "9700022001", "Meera Kulkarni");
    await t.http.get(BASE).set(auth).expect(404);
    const started = await t.http.post(BASE).set(auth).expect(201);
    expect(started.body.id).toMatch(/^SA-\d+$/);
    expect(started.body.status).toBe("KYC_IN_PROGRESS");
    expect((await t.http.post(BASE).set(auth).expect(200)).body.id).toBe(started.body.id);

    // email, by one-time code
    const otp = await t.http.post("/v1/me/email/otp").set(auth).send({ email: "Meera@SahyadriHome.in" }).expect(200);
    await t.http.post("/v1/me/email/verify").set(auth).send({ code: otp.body.devCode === "000000" ? "111111" : "000000" }).expect(400);
    const me = await t.http.post("/v1/me/email/verify").set(auth).send({ code: otp.body.devCode }).expect(200);
    expect(me.body).toMatchObject({ email: "meera@sahyadrihome.in", emailVerified: true });

    // GSTIN fills the legal details and the PAN
    const bad = await t.http.post(`${BASE}/verify/gstin`).set(auth).send({ gstin: "27AAKFS4410M1ZY" }).expect(422);
    expect(bad.body.code).toBe("GSTIN_INVALID");
    await t.http.patch(BASE).set(auth).send({ constitution: "LLP" }).expect(200);
    let app = await t.http.post(`${BASE}/verify/gstin`).set(auth).send({ gstin: "27aakfs4410m1zx" }).expect(200);
    expect(app.body.business).toMatchObject({ legalName: "SAHYADRI HOME ESSENTIALS LLP", pan: "AAKFS4410M", gstState: "Maharashtra" });
    expect(app.body.checks.pan).toMatchObject({ result: "VERIFIED", nameMatchScore: 100 });

    // store name must be unique
    expect((await t.http.patch(BASE).set(auth).send({ storeName: "apex retail" }).expect(409)).body.code).toBe("STORE_NAME_TAKEN");
    expect((await t.http.get(`${BASE}/store-name`).query({ name: "Apex Retail" }).set(auth).expect(200)).body.available).toBe(false);
    await t.http
      .patch(BASE)
      .set(auth)
      .send({
        storeName: "Sahyadri Home",
        storeDescription: "Cookware from Pune",
        careNumber: "+91 20 4012 8821",
        grievanceContact: "Meera Kulkarni, grievance@sahyadrihome.in",
        pickup: PICKUP,
        categories: ["cat-home", "cat-grocery"],
        brand: { ownBrand: true, brandName: "Sahyadri Home", trademark: "5281934", trademarkClass: "21", reseller: false },
      })
      .expect(200);
    await t.http.patch(BASE).set(auth).send({ categories: ["cat-unknown"] }).expect(422);

    // penny drop: a closed account fails, the business account matches
    app = await t.http.post(`${BASE}/verify/bank`).set(auth).send({ holder: "Sahyadri Home Essentials LLP", account: "50200041230000", ifsc: "HDFC0001234" }).expect(200);
    expect(app.body.checks.bank.result).toBe("FAILED");
    await t.http.post(`${BASE}/verify/bank`).set(auth).send({ holder: "Sahyadri", account: "50200041234821", ifsc: "ZZZZ0001234" }).expect(422);
    app = await t.http.post(`${BASE}/verify/bank`).set(auth).send({ holder: "Sahyadri Home Essentials LLP", account: "50200041234821", ifsc: "HDFC0001234" }).expect(200);
    expect(app.body.checks.bank).toMatchObject({ result: "VERIFIED", bankName: "HDFC Bank", accountLast4: "4821" });
    expect(JSON.stringify(app.body)).not.toContain("50200041234821");

    // nothing is submitted until the documents are in
    const early = await t.http.post(`${BASE}/submit`).set(auth).send({ acceptAgreement: true }).expect(422);
    expect(early.body.code).toBe("APPLICATION_INCOMPLETE");
    expect(early.body.errors.map((e: { path: string }) => e.path)).toContain("documents");

    expect((await t.http.post(`${BASE}/documents`).set(auth).field("kind", "ADDRESS_PROOF").attach("file", Buffer.from("MZ not a pdf"), "bill.pdf").expect(422)).body.code).toBe("FILE_TYPE");
    await upload(auth, "SIGNATURE").expect(201);
    await upload(auth, "LLP_CERTIFICATE").expect(201);
    app = await upload(auth, "ADDRESS_PROOF", "electricity-bill.pdf").expect(201);
    const doc = app.body.documents.find((d: { kind: string }) => d.kind === "ADDRESS_PROOF");
    const file = await t.http.get(`${BASE}/documents/${doc.id}`).set(auth).expect(200);
    expect(file.headers["content-type"]).toBe("application/pdf");
    expect(Buffer.from(file.body).subarray(0, 5).toString()).toBe("%PDF-");
    expect(app.body.missing).toEqual([]);

    await t.http.post(`${BASE}/submit`).set(auth).send({}).expect(422);
    app = await t.http.post(`${BASE}/submit`).set(auth).send({ acceptAgreement: true }).expect(200);
    expect(app.body.status).toBe("UNDER_REVIEW");
    expect(app.body.events.map((e: { toStatus: string }) => e.toStatus)).toEqual(["KYC_IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW"]);
    expect(new Date(app.body.slaDueAt).getTime() - new Date(app.body.submittedAt).getTime()).toBe(72 * 3600_000);
    expect(app.body).not.toHaveProperty("riskFlags");
    expect((await t.http.patch(BASE).set(auth).send({ storeDescription: "late edit" }).expect(409)).body.code).toBe("APPLICATION_LOCKED");

    // the verifier's queue
    await t.http.get("/v1/admin/seller-applications").set(auth).expect(403);
    const queue = await t.http.get("/v1/admin/seller-applications").set(staff).expect(200);
    expect(queue.body.items.map((i: { id: string }) => i.id)).toContain(started.body.id);
    expect(queue.body.counts.awaitingReview).toBeGreaterThanOrEqual(1);
    let review = await t.http.get(`/v1/admin/seller-applications/${started.body.id}`).set(staff).expect(200);
    expect(review.body.bank.accountMasked).toBe("XXXXXXXXXX4821");
    expect(review.body.blockers).toEqual([]);
    expect(review.body.riskFlags).toEqual([]);
    await t.http.get(`/v1/admin/seller-applications/${started.body.id}/documents/${doc.id}`).set(staff).expect(200);

    // changes requested on one document, fixed, resubmitted
    review = await t.http
      .post(`/v1/admin/seller-applications/${started.body.id}/request-changes`)
      .set(staff)
      .send({ items: ["ADDRESS_PROOF"], message: "The bill is older than 3 months. Upload a recent one." })
      .expect(200);
    expect(review.body.status).toBe("ACTION_REQUIRED");
    app = await t.http.get(BASE).set(auth).expect(200);
    expect(app.body.flaggedItems).toEqual([{ key: "ADDRESS_PROOF", label: "Proof of the principal place of business" }]);
    expect(app.body.documents.find((d: { kind: string }) => d.kind === "ADDRESS_PROOF").status).toBe("REJECTED");
    await t.http.post(`${BASE}/submit`).set(auth).send({ acceptAgreement: true }).expect(422);
    await upload(auth, "ADDRESS_PROOF", "rent-agreement.pdf").expect(201);
    app = await t.http.post(`${BASE}/submit`).set(auth).send({ acceptAgreement: true }).expect(200);
    expect(app.body.status).toBe("UNDER_REVIEW");
    expect(app.body.events.at(-2).note).toBe("Resubmitted with corrections");

    // approval creates the seller; the next token carries it
    review = await t.http.post(`/v1/admin/seller-applications/${started.body.id}/approve`).set(staff).send({ note: "Documents checked against the GST certificate" }).expect(200);
    expect(review.body).toMatchObject({ status: "APPROVED", sellerId: "s-sahyadri-home" });
    expect(review.body.documents.every((d: { status: string }) => d.status === "VERIFIED")).toBe(true);
    const [seller] = await db.select().from(sellers).where(eq(sellers.id, "s-sahyadri-home"));
    expect(seller).toMatchObject({ displayName: "Sahyadri Home", status: "APPROVED", tier: "Bronze", gstin: "27AAKFS4410M1ZX", city: "Pune" });

    const refreshed = await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(200);
    expect(decodeJwt(refreshed.body.accessToken).sellers).toEqual(["s-sahyadri-home"]);
    const asSeller = { Authorization: `Bearer ${refreshed.body.accessToken}` };
    const meNow = await t.http.get("/v1/me").set(asSeller).expect(200);
    expect(meNow.body.sellers[0]).toMatchObject({ id: "s-sahyadri-home", role: "OWNER", status: "APPROVED", tier: "Bronze" });
    expect((await t.http.get("/v1/seller/order-items").set(asSeller).expect(200)).body.total).toBe(0);
    await t.http.post(BASE).set(asSeller).expect(200);
  });

  it("flags duplicates at submission and keeps blocked applications from approval", async () => {
    const [apex] = await db.select({ pan: sellers.pan }).from(sellers).where(eq(sellers.id, "s-apex"));
    const { auth } = await prepare("9700022002", { name: "Second Store", gstin: gstinFor("27", apex!.pan!), store: "Apex Outlet Pune", account: "50200041234821", constitution: "PRIVATE_LIMITED" });
    const app = await t.http.post(`${BASE}/submit`).set(auth).send({ acceptAgreement: true }).expect(200);

    const review = await t.http.get(`/v1/admin/seller-applications/${app.body.id}`).set(staff).expect(200);
    const codes = review.body.riskFlags.map((f: { code: string }) => f.code);
    expect(codes).toEqual(expect.arrayContaining(["PAN_LINKED_SELLER", "BANK_ON_OTHER_APPLICATION"]));
    expect(review.body.blockers).toContain("A high severity risk flag is open");
    const blocked = await t.http.post(`/v1/admin/seller-applications/${app.body.id}/approve`).set(staff).send({}).expect(409);
    expect(blocked.body.code).toBe("APPROVAL_BLOCKED");

    const rejected = await t.http
      .post(`/v1/admin/seller-applications/${app.body.id}/reject`)
      .set(staff)
      .send({ reason: "Linked to a suspended or rejected account", note: "Bank account belongs to another applicant" })
      .expect(200);
    expect(rejected.body.status).toBe("REJECTED");
    const mine = await t.http.get(BASE).set(auth).expect(200);
    expect(mine.body.rejectionReason).toBe("Linked to a suspended or rejected account");
    expect(JSON.stringify(mine.body)).not.toContain("Bank account belongs to another applicant");

    expect((await t.http.post(`/v1/admin/seller-applications/${app.body.id}/reopen`).set(staff).expect(409)).body.code).toBe("COOL_OFF");
    t.clock.advance(31 * 24 * 3600_000);
    const reopened = await t.http.post(`/v1/admin/seller-applications/${app.body.id}/reopen`).set(staff).expect(200);
    expect(reopened.body.status).toBe("KYC_IN_PROGRESS");
  });

  it("asks for a bank proof after a partial name match", async () => {
    const { auth } = await prepare("9700022003", { name: "Partial Match", gstin: gstinFor("29", "AAKFP7712C"), store: "Lotus Lane Living", account: "50200041232222" });
    const app = await t.http.get(BASE).set(auth).expect(200);
    expect(app.body.checks.bank.result).toBe("PARTIAL");
    expect(app.body.requiredDocuments.find((d: { kind: string }) => d.kind === "BANK_PROOF")?.required).toBe(true);
    const submitted = await t.http.post(`${BASE}/submit`).set(auth).send({ acceptAgreement: true }).expect(200);
    const review = await t.http.get(`/v1/admin/seller-applications/${submitted.body.id}`).set(staff).expect(200);
    expect(review.body.riskFlags.map((f: { code: string }) => f.code)).toContain("BANK_NAME_PARTIAL");
    expect(review.body.blockers).toEqual([]);
  });

  it("keeps GST exempt sellers on a PAN only path", async () => {
    const { auth } = await signIn(t.http, "9700022004", "Book Seller");
    await t.http.post(BASE).set(auth).expect(201);
    await t.http.patch(BASE).set(auth).send({ constitution: "PROPRIETORSHIP", gstExempt: true }).expect(200);
    expect((await t.http.post(`${BASE}/verify/gstin`).set(auth).send({ gstin: "27AAKFS4410M1ZX" }).expect(409)).body.code).toBe("GST_EXEMPT");
    const app = await t.http.post(`${BASE}/verify/pan`).set(auth).send({ pan: "ABCPS1234K", legalName: "Suresh Sharma" }).expect(200);
    expect(app.body.business).toMatchObject({ pan: "ABCPS1234K", legalName: "Suresh Sharma", gstin: null });
    expect(app.body.checks.pan.result).toBe("VERIFIED");
    const mismatch = await t.http.post(`${BASE}/verify/pan`).set(auth).send({ pan: "ABCPS9999K", legalName: "Suresh Sharma" }).expect(200);
    expect(mismatch.body.checks.pan.result).toBe("FAILED");
    expect(mismatch.body.missing.map((m: { key: string }) => m.key)).toContain("pan");
  });

  it("limits who can read and decide applications", async () => {
    await t.http.get("/v1/admin/seller-applications").expect(401);
    const shopper = (await signIn(t.http, DEMO_CUSTOMER)).auth;
    await t.http.get("/v1/admin/seller-applications").set(shopper).expect(403);

    const { session } = await signIn(t.http, "9700022099", "Audit Person");
    await db.update(users).set({ staffRoles: ["AUDITOR"] }).where(eq(users.id, session.user.id));
    const refreshed = await t.http.post("/v1/auth/refresh").send({ refreshToken: session.refreshToken }).expect(200);
    const auditor = { Authorization: `Bearer ${refreshed.body.accessToken}` };
    const list = await t.http.get("/v1/admin/seller-applications").query({ tab: "decided" }).set(auditor).expect(200);
    const anyId = list.body.items[0].id;
    const denied = await t.http.post(`/v1/admin/seller-applications/${anyId}/reopen`).set(auditor).expect(403);
    expect(denied.body.detail).toMatch(/role does not allow/);
  });
});
