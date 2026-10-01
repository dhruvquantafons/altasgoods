import type { Constitution } from "../../../db/schema.js";

/** GST state codes (first two characters of a GSTIN). Names match the web app's state list. */
export const GST_STATES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};

export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const BASE36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** The GSTIN check character (15th) for the first 14 characters, per the GSTN algorithm. */
export function gstinCheckChar(first14: string) {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = BASE36.indexOf(first14[i]!) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return BASE36[(36 - (sum % 36)) % 36]!;
}

/** Format, state code and check digit. Returns a reason when the GSTIN cannot be right. */
export function gstinProblem(gstin: string): string | null {
  if (!GSTIN_RE.test(gstin)) return "A GSTIN is 15 characters: state code, PAN, entity number, Z and a check character";
  if (!GST_STATES[gstin.slice(0, 2)]) return "The first two digits are not a valid GST state code";
  if (gstinCheckChar(gstin.slice(0, 14)) !== gstin[14]) return "The last character does not match the rest of the GSTIN. Check for a typing mistake.";
  return null;
}

/** The fourth PAN character says who holds it. */
export const PAN_HOLDER_TYPES: Record<string, string> = {
  P: "Individual",
  C: "Company",
  H: "Hindu undivided family",
  F: "Firm or LLP",
  A: "Association of persons",
  T: "Trust",
  B: "Body of individuals",
  L: "Local authority",
  J: "Artificial juridical person",
  G: "Government",
};

/** PAN holder type each business constitution must have. */
export const PAN_TYPE_FOR: Record<Constitution, string> = {
  PROPRIETORSHIP: "P",
  PARTNERSHIP: "F",
  LLP: "F",
  PRIVATE_LIMITED: "C",
  PUBLIC_LIMITED: "C",
};

/** Bank codes (first four IFSC characters) the sandbox recognises. */
export const BANKS: Record<string, string> = {
  HDFC: "HDFC Bank",
  ICIC: "ICICI Bank",
  SBIN: "State Bank of India",
  UTIB: "Axis Bank",
  KKBK: "Kotak Mahindra Bank",
  PUNB: "Punjab National Bank",
  BARB: "Bank of Baroda",
  CNRB: "Canara Bank",
  UBIN: "Union Bank of India",
  IDIB: "Indian Bank",
  YESB: "Yes Bank",
  INDB: "IndusInd Bank",
  IDFB: "IDFC FIRST Bank",
  FDRL: "Federal Bank",
  BKID: "Bank of India",
  CBIN: "Central Bank of India",
  IOBA: "Indian Overseas Bank",
  MAHB: "Bank of Maharashtra",
  RATN: "RBL Bank",
  AUBL: "AU Small Finance Bank",
};
