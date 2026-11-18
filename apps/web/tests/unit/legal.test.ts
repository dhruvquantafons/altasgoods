import { describe, expect, it } from "vitest";
import {
  companyEmail,
  companyLegalName,
  companyPhone,
  companyRegisteredOffice,
  mailtoHref,
  realText,
  telHref,
  isPlaceholderText,
  legalDeclarations,
  PLACEHOLDER_TEXT,
  type LegalProduct,
} from "@/lib/legal";

const company = {
  legalName: "Acme Retail Private Limited",
  registeredOffice: "1 Test Street, Test City 100001",
};
const placeholderCompany = {
  legalName: "Your Company Private Limited (not set)",
  registeredOffice: "Registered office address not set",
};

const product = (extra: Partial<LegalProduct> = {}): LegalProduct => ({
  title: "Cotton Tea Towel 2 Pieces",
  subcategory: "Towels",
  mrp: 1499,
  specs: [],
  legal: null,
  ...extra,
});
const row = (rows: ReturnType<typeof legalDeclarations>, label: string) =>
  rows.find((r) => r.label === label)!;

describe("legalDeclarations", () => {
  it("marks everything the store has not filled in as a placeholder, and invents nothing", () => {
    const rows = legalDeclarations(product(), placeholderCompany);
    for (const label of [
      "Manufacturer",
      "Packer",
      "Consumer care",
      "Country of origin",
      "Importer",
    ]) {
      expect(row(rows, label)).toMatchObject({
        value: PLACEHOLDER_TEXT,
        placeholder: true,
      });
    }
    expect(JSON.stringify(rows)).not.toMatch(/@|KIADB|Plot|1800/);
    for (const label of ["Generic name", "Net quantity", "M.R.P."])
      expect(row(rows, label).placeholder).toBe(false);
  });

  it("keeps the generic name, net quantity and MRP logic", () => {
    const rows = legalDeclarations(
      product({ title: "Chilli Powder 200 g" }),
      company,
    );
    expect(row(rows, "Generic name").value).toBe("Towel");
    expect(row(rows, "Net quantity").value).toBe("200 g");
    expect(
      row(legalDeclarations(product(), company), "Net quantity").value,
    ).toBe("2 N");
    expect(row(rows, "M.R.P.").value).toBe("₹1,499 (inclusive of all taxes)");
  });

  it("uses the product's own declarations", () => {
    const legal = {
      manufacturer: "Maker Co, Pune",
      packer: "Packer Ltd, Mumbai",
      importer: "Importer Ltd, Delhi",
      consumerCare: "help@maker.example",
      countryOfOrigin: "China",
    };
    const rows = legalDeclarations(product({ legal }), company);
    expect(row(rows, "Manufacturer")).toEqual({
      label: "Manufacturer",
      value: "Maker Co, Pune",
      placeholder: false,
    });
    expect(row(rows, "Packer").value).toBe("Packer Ltd, Mumbai");
    expect(row(rows, "Importer").value).toBe("Importer Ltd, Delhi");
    expect(row(rows, "Consumer care").value).toBe("help@maker.example");
    expect(row(rows, "Country of origin").value).toBe("China");
  });

  it("takes the country of origin from the product, then the specs", () => {
    const specs = [
      {
        group: "General",
        items: [{ label: "Country of origin", value: "Vietnam" }],
      },
    ];
    expect(
      row(legalDeclarations(product({ specs }), company), "Country of origin"),
    ).toMatchObject({ value: "Vietnam", placeholder: false });
    expect(
      row(
        legalDeclarations(
          product({ specs, legal: { countryOfOrigin: "India" } }),
          company,
        ),
        "Country of origin",
      ).value,
    ).toBe("India");
  });

  describe("importer", () => {
    it("is not applicable only when the country of origin is India", () => {
      const india = legalDeclarations(
        product({ legal: { countryOfOrigin: "india" } }),
        company,
      );
      expect(row(india, "Importer")).toMatchObject({
        value: "Not applicable (made in India)",
        placeholder: false,
      });
      const abroad = legalDeclarations(
        product({ legal: { countryOfOrigin: "China" } }),
        company,
      );
      expect(row(abroad, "Importer")).toMatchObject({
        value: PLACEHOLDER_TEXT,
        placeholder: true,
      });
      const unknown = legalDeclarations(product(), company);
      expect(row(unknown, "Importer").placeholder).toBe(true);
    });

    it("prefers what the product says", () => {
      const rows = legalDeclarations(
        product({
          legal: { countryOfOrigin: "India", importer: "Importer Ltd" },
        }),
        company,
      );
      expect(row(rows, "Importer").value).toBe("Importer Ltd");
    });
  });

  describe("packer", () => {
    it("falls back to the store's company when its details are set", () => {
      const rows = legalDeclarations(product(), company);
      expect(row(rows, "Packer")).toEqual({
        label: "Packer",
        value: "Acme Retail Private Limited, 1 Test Street, Test City 100001",
        placeholder: false,
      });
    });

    it("stays a placeholder when the company's name or address is still a placeholder", () => {
      expect(
        row(legalDeclarations(product(), placeholderCompany), "Packer")
          .placeholder,
      ).toBe(true);
      expect(
        row(
          legalDeclarations(product(), {
            ...company,
            registeredOffice: placeholderCompany.registeredOffice,
          }),
          "Packer",
        ).placeholder,
      ).toBe(true);
      expect(
        row(
          legalDeclarations(product(), {
            ...company,
            legalName: placeholderCompany.legalName,
          }),
          "Packer",
        ).placeholder,
      ).toBe(true);
    });
  });
});

describe("isPlaceholderText", () => {
  it("recognises the defaults a fresh store starts with", () => {
    for (const v of [
      "",
      "  ",
      "NOT SET",
      "Not set",
      placeholderCompany.legalName,
      placeholderCompany.registeredOffice,
    ])
      expect(isPlaceholderText(v)).toBe(true);
    for (const v of ["Acme Retail Private Limited", "1 Test Street, Test City"])
      expect(isPlaceholderText(v)).toBe(false);
  });
});

describe("companyLegalName and companyEmail", () => {
  it("give the real value, and null while it is a placeholder", () => {
    expect(companyLegalName(company)).toBe("Acme Retail Private Limited");
    expect(companyLegalName(placeholderCompany)).toBeNull();
    expect(companyLegalName({ legalName: "  " })).toBeNull();
    expect(companyEmail({ email: "care@acme.test" })).toBe("care@acme.test");
    expect(companyEmail({ email: "care@example.com" })).toBeNull();
    expect(companyEmail({ email: "" })).toBeNull();
  });
});

describe("customer care and grievance gating", () => {
  const defaults = {
    customerCare: "Not set",
    customerCareHours: "Not set",
    cin: "NOT SET",
    gstin: "NOT SET",
    email: "care@example.com",
    grievanceName: "Grievance Officer (name not set)",
    grievanceEmail: "grievance@example.com",
    grievancePhone: "Not set",
    grievanceAddress: "Not set",
  };

  it("treats every default a fresh store starts with as a placeholder", () => {
    for (const v of Object.values(defaults)) expect(realText(v)).toBeNull();
    expect(companyPhone({ customerCare: defaults.customerCare })).toBeNull();
    expect(companyRegisteredOffice(placeholderCompany)).toBeNull();
  });

  it("passes real values through, trimmed", () => {
    expect(companyPhone({ customerCare: " 1800 111 1111 " })).toBe("1800 111 1111");
    expect(companyRegisteredOffice(company)).toBe("1 Test Street, Test City 100001");
    expect(realText("A. Officer")).toBe("A. Officer");
    expect(realText("officer@acme.test")).toBe("officer@acme.test");
  });

  it("gives no mailto or tel link for a placeholder", () => {
    expect(mailtoHref(defaults.grievanceEmail)).toBeUndefined();
    expect(mailtoHref("")).toBeUndefined();
    expect(telHref(defaults.grievancePhone)).toBeUndefined();
    expect(mailtoHref("officer@acme.test")).toBe("mailto:officer@acme.test");
    expect(telHref("1800 111 1111")).toBe("tel:18001111111");
  });
});
