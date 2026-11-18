/**
 * Legal Metrology declarations for a product page. Anything the store has not
 * filled in comes back flagged as a placeholder, never as an invented value.
 */

export interface ProductLegal {
  manufacturer?: string;
  packer?: string;
  importer?: string;
  consumerCare?: string;
  countryOfOrigin?: string;
}

export interface LegalProduct {
  title: string;
  subcategory: string;
  /** in rupees */
  mrp: number;
  specs: { group: string; items: { label: string; value: string }[] }[];
  legal?: ProductLegal | null;
}

export interface LegalRow {
  label: string;
  value: string;
  /** true when the store has not supplied this yet; the page marks it so nobody reads it as data */
  placeholder: boolean;
}

export const PLACEHOLDER_TEXT = "To be added by the store";

/** True for a blank value or one of the placeholder defaults a fresh store starts with ("not set", example.com); the one definition the web uses, mirroring settingsPlaceholders in the API. */
export function isPlaceholderText(v: string | null | undefined) {
  const t = (v ?? "").trim();
  return t === "" || /\bnot set\b/i.test(t) || /(^|[@/.])example\.com\b/i.test(t);
}

/** The trimmed value, or null while it is a placeholder. */
export function realText(v: string | null | undefined): string | null {
  return isPlaceholderText(v) ? null : v!.trim();
}

/** The company's legal name, or null while it is still the placeholder; callers then show just the brand. */
export const companyLegalName = (company: { legalName: string }) => realText(company.legalName);
/** The company's contact email, or null while it is still the placeholder. */
export const companyEmail = (company: { email: string }) => realText(company.email);
/** The customer care number, or null while it is still the placeholder. */
export const companyPhone = (company: { customerCare: string }) => realText(company.customerCare);
export const companyRegisteredOffice = (company: { registeredOffice: string }) => realText(company.registeredOffice);

/** A mailto link, or undefined while the address is a placeholder. */
export const mailtoHref = (email: string | null | undefined) => (realText(email) ? `mailto:${email!.trim()}` : undefined);
/** A tel link, or undefined while the number is a placeholder. */
export const telHref = (phone: string | null | undefined) => (realText(phone) ? `tel:${phone!.replace(/\s/g, "")}` : undefined);

function netQuantity(title: string) {
  const m = title.match(/(\d+(?:\.\d+)?)\s?(g|kg|ml|L)\b/);
  if (m) return `${m[1]} ${m[2]}`;
  const set = title.match(/(?:Set|Pack) of (\d+)/i);
  if (set) return `${set[1]} N`;
  const pcs = title.match(/(\d+) Pieces/i);
  if (pcs) return `${pcs[1]} N`;
  return "1 N";
}

const given = (v: string | undefined) => (v?.trim() ? v.trim() : undefined);
const real = (label: string, value: string): LegalRow => ({
  label,
  value,
  placeholder: false,
});
const maybe = (label: string, value: string | undefined): LegalRow =>
  value
    ? real(label, value)
    : { label, value: PLACEHOLDER_TEXT, placeholder: true };

/** The declarations shown on every product page. `company` is the store's own legal name and registered office from Settings. */
export function legalDeclarations(
  p: LegalProduct,
  company: { legalName: string; registeredOffice: string },
): LegalRow[] {
  const legal = p.legal ?? {};
  const origin =
    given(legal.countryOfOrigin) ??
    given(
      p.specs
        .flatMap((s) => s.items)
        .find((i) => i.label === "Country of origin")?.value,
    );
  const companyIsSet =
    !isPlaceholderText(company.legalName) &&
    !isPlaceholderText(company.registeredOffice);
  const packer =
    given(legal.packer) ??
    (companyIsSet
      ? `${company.legalName.trim()}, ${company.registeredOffice.trim()}`
      : undefined);
  const importer =
    given(legal.importer) ??
    (origin?.toLowerCase() === "india"
      ? "Not applicable (made in India)"
      : undefined);
  return [
    real("Generic name", p.subcategory.replace(/s$/, "")),
    real("Net quantity", netQuantity(p.title)),
    real(
      "M.R.P.",
      `₹${p.mrp.toLocaleString("en-IN")} (inclusive of all taxes)`,
    ),
    maybe("Country of origin", origin),
    maybe("Manufacturer", given(legal.manufacturer)),
    maybe("Packer", packer),
    maybe("Importer", importer),
    maybe("Consumer care", given(legal.consumerCare)),
  ];
}
