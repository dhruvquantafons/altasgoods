import { createHash, randomInt } from "node:crypto";
import type { Constitution } from "../../../db/schema.js";
import { BANKS, GST_STATES, PAN_TYPE_FOR } from "./india.js";
import { nameTokens } from "./names.js";
import type { GstLookup, IfscLookup, KycProvider, PanLookup, PennyDropResult } from "./provider.js";

/**
 * Deterministic stand-in for the GSTN, PAN and penny drop services, so the
 * whole onboarding flow works locally. Test values, like test card numbers:
 *
 * - Any GSTIN with a valid check character is ACTIVE, with a business name
 *   derived from its PAN. 27AAKFS4410M1ZX is Sahyadri Home Essentials LLP.
 *   29AAGCK7781Q1ZF is a CANCELLED registration.
 * - A PAN whose digits are 0000 is not found; 9999 returns a different holder.
 * - A bank account ending 0000 fails the penny drop; 1111 returns another
 *   person's name; 2222 returns a shortened name (a partial match, so a bank
 *   proof is requested). Any other account returns the business name.
 */
export const SANDBOX_FIXTURES: Record<string, GstLookup> = {
  "27AAKFS4410M1ZX": {
    status: "ACTIVE",
    legalName: "SAHYADRI HOME ESSENTIALS LLP",
    tradeName: "Sahyadri Home",
    constitution: "LLP",
    state: "Maharashtra",
    principalAddress: "Plot 12, Sector 7, Bhosari MIDC, Pune 411026",
    registeredOn: "2019-06-14",
    filing: "GSTR-1 and GSTR-3B filed up to Aug 2026",
  },
  "29AAGCK7781Q1ZF": {
    status: "CANCELLED",
    legalName: "KAVERI GOURMET FOODS PRIVATE LIMITED",
    tradeName: "Kaveri Gourmet",
    constitution: "PRIVATE_LIMITED",
    state: "Karnataka",
    principalAddress: "14, 2nd Cross, Peenya Industrial Area, Bengaluru 560058",
    registeredOn: "2018-02-03",
    filing: "Registration cancelled on 12 Mar 2026",
  },
  // registrations used by the demo seed
  "29ABCPB4821K1ZS": {
    status: "ACTIVE",
    legalName: "ARJUN BHAT",
    tradeName: "Bhat Electronics Hub",
    constitution: "PROPRIETORSHIP",
    state: "Karnataka",
    principalAddress: "No. 48, 5th Main, Koramangala 4th Block, Bengaluru 560034",
    registeredOn: "2021-08-02",
    filing: "GSTR-1 and GSTR-3B filed up to Aug 2026",
  },
  "33AAJCN5521H1ZL": {
    status: "ACTIVE",
    legalName: "NILGIRI PANTRY FOODS PRIVATE LIMITED",
    tradeName: "Nilgiri Pantry",
    constitution: "PRIVATE_LIMITED",
    state: "Tamil Nadu",
    principalAddress: "22, Industrial Estate, Guindy, Chennai 600032",
    registeredOn: "2022-11-21",
    filing: "GSTR-1 and GSTR-3B filed up to Aug 2026",
  },
  "32AALFM7310D1ZP": {
    status: "ACTIVE",
    legalName: "MALABAR SPICE ROUTE LLP",
    tradeName: "Malabar Spice Route",
    constitution: "LLP",
    state: "Kerala",
    principalAddress: "Building 9, KINFRA Park, Kalamassery, Kochi 683503",
    registeredOn: "2020-03-09",
    filing: "GSTR-1 and GSTR-3B filed up to Aug 2026",
  },
  "09AAWPV2290R1ZB": {
    status: "ACTIVE",
    legalName: "ROHIT VERMA",
    tradeName: "Verma Sports Arena",
    constitution: "PROPRIETORSHIP",
    state: "Uttar Pradesh",
    principalAddress: "Shop 4, Sports Goods Market, Meerut 250002",
    registeredOn: "2019-01-17",
    filing: "GSTR-1 and GSTR-3B filed up to Aug 2026",
  },
  "24AADPD6612M1ZW": {
    status: "ACTIVE",
    legalName: "SNEHA DESAI",
    tradeName: "Desai Celebrations",
    constitution: "PROPRIETORSHIP",
    state: "Gujarat",
    principalAddress: "17, Relief Road, Ahmedabad 380001",
    registeredOn: "2023-06-30",
    filing: "GSTR-1 and GSTR-3B filed up to Jul 2026",
  },
};

const WORDS: Record<string, string> = {
  A: "Aarohi", B: "Bharat", C: "Chandan", D: "Devika", E: "Ekta", F: "Falcon", G: "Ganga", H: "Himalaya", I: "Indus", J: "Jaipur", K: "Kaveri", L: "Lotus", M: "Meridian",
  N: "Narmada", O: "Orchid", P: "Pragati", Q: "Quill", R: "Riddhi", S: "Shree", T: "Tulsi", U: "Utkarsh", V: "Vasant", W: "Westwind", X: "Xenia", Y: "Yamuna", Z: "Zenith",
};
const SURNAMES: Record<string, string> = {
  A: "Agarwal", B: "Bhat", C: "Chopra", D: "Desai", E: "Easwaran", F: "Fernandes", G: "Gupta", H: "Hegde", I: "Iyer", J: "Joshi", K: "Kulkarni", L: "Lal", M: "Mehta",
  N: "Nair", O: "Oberoi", P: "Patil", Q: "Qureshi", R: "Rao", S: "Sharma", T: "Thakur", U: "Upadhyay", V: "Verma", W: "Wadia", X: "Xavier", Y: "Yadav", Z: "Zaveri",
};
const FIRST_NAMES = ["Aarav", "Meera", "Rohit", "Priya", "Karan", "Sneha", "Vikram", "Anjali", "Farhan", "Lakshmi"];
const TRADES = ["Traders", "Enterprises", "Retail", "Lifestyle", "Home Store", "Supplies"];
const CITY_FOR: Record<string, string> = {
  Maharashtra: "Pune", Karnataka: "Bengaluru", Delhi: "New Delhi", "Tamil Nadu": "Chennai", Telangana: "Hyderabad", Gujarat: "Ahmedabad", "West Bengal": "Kolkata",
  "Uttar Pradesh": "Noida", Rajasthan: "Jaipur", Kerala: "Kochi", Haryana: "Gurugram", Punjab: "Ludhiana",
};
const AREAS = ["Industrial Estate", "MIDC Phase 2", "Sector 18", "Ring Road", "Station Road", "Market Yard", "Main Road", "Commercial Complex"];
const BRANCHES = ["Main branch", "City branch", "Industrial Area branch", "Market branch", "Station Road branch"];

const pick = <T,>(list: T[], seed: string) => list[createHash("sha256").update(seed).digest()[0]! % list.length]!;

/** A plausible, stable business name for a PAN (the 5th character is the name's initial). */
function nameForPan(pan: string, constitution?: Constitution | null) {
  const initial = pan[4]!;
  const type = pan[3]!;
  if (type === "P") return `${pick(FIRST_NAMES, pan)} ${SURNAMES[initial] ?? "Kumar"}`.toUpperCase();
  const base = `${WORDS[initial] ?? "Bharat"} ${pick(TRADES, pan)}`;
  if (type === "C") return `${base} ${constitution === "PUBLIC_LIMITED" ? "LIMITED" : "PRIVATE LIMITED"}`.toUpperCase();
  if (type === "F") return `${base}${constitution === "PARTNERSHIP" ? "" : " LLP"}`.toUpperCase();
  return base.toUpperCase();
}

function constitutionForPan(pan: string, hint?: Constitution | null): Constitution {
  const type = pan[3]!;
  // the registration matches the claimed constitution whenever the PAN type allows it
  if (hint && PAN_TYPE_FOR[hint] === type) return hint;
  return type === "C" ? "PRIVATE_LIMITED" : type === "F" ? "LLP" : "PROPRIETORSHIP";
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

export class SandboxKycProvider implements KycProvider {
  readonly name = "SANDBOX" as const;

  async lookupGstin(gstin: string, hint: { constitution?: Constitution | null }): Promise<GstLookup> {
    const fixture = SANDBOX_FIXTURES[gstin];
    if (fixture) return fixture;
    const pan = gstin.slice(2, 12);
    const state = GST_STATES[gstin.slice(0, 2)] ?? "Maharashtra";
    const constitution = constitutionForPan(pan, hint.constitution);
    const legalName = nameForPan(pan, constitution);
    const city = CITY_FOR[state] ?? state;
    return {
      status: "ACTIVE",
      legalName,
      tradeName: titleCase(legalName.replace(/ (PRIVATE LIMITED|LIMITED|LLP)$/, "")),
      constitution,
      state,
      principalAddress: `${10 + (gstin.charCodeAt(7) % 80)}, ${pick(AREAS, gstin)}, ${city}`,
      registeredOn: `20${18 + (gstin.charCodeAt(9) % 7)}-0${1 + (gstin.charCodeAt(8) % 9)}-1${gstin.charCodeAt(6) % 10}`,
      filing: "GSTR-1 and GSTR-3B filed up to Aug 2026",
    };
  }

  async lookupPan(pan: string, expectedName: string | null): Promise<PanLookup> {
    const digits = pan.slice(5, 9);
    if (digits === "0000") return { status: "NOT_FOUND", holderName: "", aadhaarLinked: false };
    if (digits === "9999") return { status: "VALID", holderName: "SURESH KUMAR", aadhaarLinked: true };
    const fixture = Object.entries(SANDBOX_FIXTURES).find(([g]) => g.slice(2, 12) === pan)?.[1];
    return { status: "VALID", holderName: (fixture?.legalName ?? expectedName ?? nameForPan(pan)).toUpperCase(), aadhaarLinked: pan[3] === "P" ? true : digits !== "1111" };
  }

  async lookupIfsc(ifsc: string): Promise<IfscLookup | null> {
    const bankName = BANKS[ifsc.slice(0, 4)];
    if (!bankName) return null;
    return { bankName, branch: ifsc === "HDFC0001234" ? "Pimpri, Pune" : pick(BRANCHES, ifsc) };
  }

  async pennyDrop(input: { account: string; ifsc: string; expectedName: string }): Promise<PennyDropResult> {
    const reference = `SBX${String(randomInt(0, 1e9)).padStart(9, "0")}`;
    if (input.account.endsWith("0000")) return { status: "FAILED", beneficiaryName: null, reference, failureReason: "The bank reports this account as closed or invalid" };
    if (input.account.endsWith("1111")) return { status: "SUCCESS", beneficiaryName: "RAVI KUMAR PATIL", reference };
    if (input.account.endsWith("2222")) {
      const words = nameTokens(input.expectedName);
      return { status: "SUCCESS", beneficiaryName: [...words.slice(0, -1), words.at(-1)!.slice(0, 3)].join(" "), reference };
    }
    return { status: "SUCCESS", beneficiaryName: input.expectedName.toUpperCase(), reference };
  }
}
