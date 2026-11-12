import { describe, expect, it } from "vitest";
import { createKycSchema } from "./KycDialog";
import type { KycDocumentRule } from "@/services/api/kyc";

const bvnRule: KycDocumentRule = {
  type: "BVN",
  label: "BVN",
  pattern: "^\\d{11}$",
  hint: "11-digit Bank Verification Number",
  issuerCountries: ["NG"],
};

const ninRule: KycDocumentRule = {
  type: "NATIONAL_ID",
  label: "NIN",
  pattern: "^\\d{11}$",
  hint: "11-digit National Identity Number",
  issuerCountries: ["NG"],
};

describe("KycDialog Zod Schema Validation", () => {
  const defaultValidInput = {
    country: "NG",
    fullName: "Progress Ojemeh",
    dateOfBirth: "1995-05-15",
    documentType: "BVN",
    documentNumber: "12345678901",
    phone: "+2348012345678",
  };

  it("passes validation with complete valid details", () => {
    const schema = createKycSchema({
      selectedRule: bvnRule,
      phoneRequired: false,
    });
    const result = schema.safeParse(defaultValidInput);
    expect(result.success).toBe(true);
  });

  describe("fullName validation", () => {
    const schema = createKycSchema({
      selectedRule: bvnRule,
      phoneRequired: false,
    });

    it("rejects empty full legal name", () => {
      const result = schema.safeParse({
        ...defaultValidInput,
        fullName: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("fullName"))).toBe(true);
      }
    });

    it("rejects names with digits", () => {
      const result = schema.safeParse({
        ...defaultValidInput,
        fullName: "John Doe 2nd",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (i) => i.message === "Full legal name should not contain numbers",
          ),
        ).toBe(true);
      }
    });

    it("requires at least first and last name", () => {
      const result = schema.safeParse({
        ...defaultValidInput,
        fullName: "Progress",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            i.message.includes("first and last name"),
          ),
        ).toBe(true);
      }
    });
  });

  describe("dateOfBirth validation", () => {
    const schema = createKycSchema({
      selectedRule: bvnRule,
      requirements: {
        country: "NG",
        documents: [bvnRule],
        phone: { required: false, pattern: "", hint: "" },
        minimumAge: 18,
      },
      phoneRequired: false,
    });

    it("rejects empty date of birth", () => {
      const result = schema.safeParse({
        ...defaultValidInput,
        dateOfBirth: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("dateOfBirth"))).toBe(true);
      }
    });

    it("rejects future dates", () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const result = schema.safeParse({
        ...defaultValidInput,
        dateOfBirth: futureDate.toISOString().slice(0, 10),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            i.message.includes("cannot be in the future"),
          ),
        ).toBe(true);
      }
    });

    it("rejects underage users below minimum age", () => {
      const today = new Date();
      const under18 = new Date(today.getFullYear() - 15, today.getMonth(), today.getDate());
      const result = schema.safeParse({
        ...defaultValidInput,
        dateOfBirth: under18.toISOString().slice(0, 10),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            i.message.includes("at least 18 years old"),
          ),
        ).toBe(true);
      }
    });
  });

  describe("documentNumber validation", () => {
    it("rejects invalid document format for BVN (10 digits instead of 11)", () => {
      const schema = createKycSchema({
        selectedRule: bvnRule,
        phoneRequired: false,
      });
      const result = schema.safeParse({
        ...defaultValidInput,
        documentNumber: "1234567890", // only 10 digits
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (i) =>
              i.path.includes("documentNumber") &&
              i.message.includes("Enter a valid BVN"),
          ),
        ).toBe(true);
      }
    });

    it("allows blank documentNumber when a saved document is already on file", () => {
      const schema = createKycSchema({
        selectedRule: bvnRule,
        savedDocument: {
          type: "BVN",
          issuerCountry: "NG",
          last4: "8901",
        },
        phoneRequired: false,
      });
      const result = schema.safeParse({
        ...defaultValidInput,
        documentNumber: "", // blank, re-using saved document
      });
      expect(result.success).toBe(true);
    });

    it("rejects blank documentNumber when no saved document exists", () => {
      const schema = createKycSchema({
        selectedRule: bvnRule,
        savedDocument: undefined,
        phoneRequired: false,
      });
      const result = schema.safeParse({
        ...defaultValidInput,
        documentNumber: "",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            i.message.includes("Enter your BVN number"),
          ),
        ).toBe(true);
      }
    });

    it("validates NIN against NIN pattern", () => {
      const schema = createKycSchema({
        selectedRule: ninRule,
        phoneRequired: false,
      });
      const invalidNin = schema.safeParse({
        ...defaultValidInput,
        documentType: "NATIONAL_ID",
        documentNumber: "ABC123",
      });
      expect(invalidNin.success).toBe(false);

      const validNin = schema.safeParse({
        ...defaultValidInput,
        documentType: "NATIONAL_ID",
        documentNumber: "12345678901",
      });
      expect(validNin.success).toBe(true);
    });
  });

  describe("phone validation", () => {
    it("requires phone when phoneRequired is true", () => {
      const schema = createKycSchema({
        selectedRule: bvnRule,
        requirements: {
          country: "NG",
          documents: [bvnRule],
          phone: {
            required: true,
            pattern: "^\\+?[1-9]\\d{9,14}$",
            hint: "Enter a valid international phone number",
          },
          minimumAge: 18,
        },
        phoneRequired: true,
      });

      const missingPhone = schema.safeParse({
        ...defaultValidInput,
        phone: "",
      });
      expect(missingPhone.success).toBe(false);

      const invalidPhone = schema.safeParse({
        ...defaultValidInput,
        phone: "123",
      });
      expect(invalidPhone.success).toBe(false);

      const validPhone = schema.safeParse({
        ...defaultValidInput,
        phone: "+2348012345678",
      });
      expect(validPhone.success).toBe(true);
    });
  });
});
