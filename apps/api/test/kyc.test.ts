import { describe, expect, it } from "vitest";
import { samplePdf, sampleSignaturePng } from "../src/db/sample-files.js";
import { sniffMime } from "../src/modules/sellers/files.js";
import { gstinCheckChar, gstinProblem } from "../src/modules/sellers/kyc/india.js";
import { matchResult, nameMatchScore } from "../src/modules/sellers/kyc/names.js";
import { SandboxKycProvider } from "../src/modules/sellers/kyc/sandbox.provider.js";
import { documentRequirements } from "../src/modules/sellers/onboarding.rules.js";

describe("GSTIN", () => {
  it("validates the check character with the GSTN algorithm", () => {
    // published examples
    for (const g of ["27AAPFU0939F1ZV", "29AAGCB7383J1Z4", "33AAACH7409R1Z8"]) expect(gstinCheckChar(g.slice(0, 14))).toBe(g[14]);
    expect(gstinProblem("27AAPFU0939F1ZV")).toBeNull();
  });

  it("explains what is wrong", () => {
    expect(gstinProblem("27AAPFU0939F1ZW")).toMatch(/last character/);
    expect(gstinProblem("99AAPFU0939F1ZV")).toMatch(/state code/);
    expect(gstinProblem("27AAPFU0939F1Z")).toMatch(/15 characters/);
  });
});

describe("name matching", () => {
  it("ignores legal suffixes, case and word order", () => {
    expect(nameMatchScore("Apex Retail Private Limited", "APEX RETAIL PVT LTD")).toBe(100);
    expect(nameMatchScore("Sahyadri Home Essentials LLP", "SAHYADRI HOME ESSENTIALS")).toBe(100);
    expect(nameMatchScore("Meera Kulkarni", "KULKARNI MEERA")).toBeGreaterThanOrEqual(85);
  });

  it("tolerates a small spelling difference but not a different name", () => {
    expect(matchResult(nameMatchScore("Sahyadri Home Essentials LLP", "SAHYADRI HOME ESSENTIAL"))).toBe("VERIFIED");
    expect(matchResult(nameMatchScore("Kaveri Traders", "KAVERI TRADING COMPANY"))).toBe("PARTIAL");
    expect(matchResult(nameMatchScore("Sahyadri Home Essentials LLP", "RAVI KUMAR PATIL"))).toBe("FAILED");
  });
});

describe("sandbox KYC provider", () => {
  const kyc = new SandboxKycProvider();

  it("knows the documented test GSTINs and derives stable names for others", async () => {
    expect((await kyc.lookupGstin("27AAKFS4410M1ZX", {})).legalName).toBe("SAHYADRI HOME ESSENTIALS LLP");
    expect((await kyc.lookupGstin("29AAGCK7781Q1ZF", {})).status).toBe("CANCELLED");
    const a = await kyc.lookupGstin("07AABCU9603R1ZP", { constitution: "PUBLIC_LIMITED" });
    expect(a).toEqual(await kyc.lookupGstin("07AABCU9603R1ZP", { constitution: "PUBLIC_LIMITED" }));
    expect(a.legalName).toMatch(/^U.* LIMITED$/);
    expect(a.constitution).toBe("PUBLIC_LIMITED");
    expect(a.state).toBe("Delhi");
  });

  it("follows the penny drop test values", async () => {
    const base = { ifsc: "HDFC0001234", expectedName: "Meera Kulkarni" };
    expect((await kyc.pennyDrop({ account: "50200041230000", ...base })).status).toBe("FAILED");
    expect((await kyc.pennyDrop({ account: "50200041231111", ...base })).beneficiaryName).toBe("RAVI KUMAR PATIL");
    const partial = await kyc.pennyDrop({ account: "50200041232222", ...base });
    expect(matchResult(nameMatchScore(partial.beneficiaryName!, base.expectedName))).toBe("PARTIAL");
    expect((await kyc.pennyDrop({ account: "50200041234821", ...base })).beneficiaryName).toBe("MEERA KULKARNI");
    expect(await kyc.lookupIfsc("ZZZZ0001234")).toBeNull();
  });
});

describe("documents", () => {
  it("requires the constitution document, address proof and signature, plus bank proof after a partial match", () => {
    const app = { constitution: "LLP", bankCheck: { result: "PARTIAL" }, brand: { ownBrand: true, reseller: false } } as unknown as Parameters<typeof documentRequirements>[0];
    const docs = documentRequirements(app);
    expect(docs.filter((d) => d.required).map((d) => d.kind)).toEqual(["SIGNATURE", "LLP_CERTIFICATE", "ADDRESS_PROOF", "BANK_PROOF"]);
    expect(docs.find((d) => d.kind === "TRADEMARK")?.required).toBe(false);
  });

  it("recognises uploads by their bytes, not their name", () => {
    expect(sniffMime(samplePdf("Test"))).toBe("application/pdf");
    expect(sniffMime(sampleSignaturePng("Test"))).toBe("image/png");
    expect(sniffMime(Buffer.from("MZ\x90\x00 not a document"))).toBeNull();
  });
});
