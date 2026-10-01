import type { Constitution } from "../../../db/schema.js";

export interface GstLookup {
  status: "ACTIVE" | "CANCELLED" | "SUSPENDED" | "NOT_FOUND";
  legalName: string;
  tradeName: string;
  constitution: Constitution;
  state: string;
  principalAddress: string;
  registeredOn: string;
  filing: string;
}

export interface PanLookup {
  status: "VALID" | "NOT_FOUND";
  holderName: string;
  aadhaarLinked: boolean;
}

export interface IfscLookup {
  bankName: string;
  branch: string;
}

export interface PennyDropResult {
  status: "SUCCESS" | "FAILED";
  /** name the bank holds for the account */
  beneficiaryName: string | null;
  reference: string;
  failureReason?: string;
}

/**
 * KYC verification boundary: GSTN, the Income Tax PAN service, and a bank
 * account validation (penny drop) service. The sandbox implements it today;
 * a licensed KYC aggregator plugs in behind the same shape.
 */
export interface KycProvider {
  readonly name: "SANDBOX";
  lookupGstin(gstin: string, hint: { constitution?: Constitution | null }): Promise<GstLookup>;
  lookupPan(pan: string, expectedName: string | null): Promise<PanLookup>;
  lookupIfsc(ifsc: string): Promise<IfscLookup | null>;
  pennyDrop(input: { account: string; ifsc: string; expectedName: string }): Promise<PennyDropResult>;
}
