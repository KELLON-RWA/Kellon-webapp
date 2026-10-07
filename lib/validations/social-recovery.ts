import * as z from "zod";

// --- Validation Schemas ---

/**
 * Validates the Guardian ID input.
 * Accepts @tags (min 3 chars) or standard User IDs (min 6 chars).
 */
export const guardianSchema = z.object({
  guardianId: z
    .string()
    .trim()
    .min(1, "Identifier is required")
    // If they typed the @ manually, we strip it or handle it,
    // but usually, we just validate the text length.
    .transform((val) => val.replace(/^@/, ""))
    .refine((val) => /^[a-zA-Z0-9_.-]{3,30}$/.test(val), {
      message:
        "Use a valid Kellon tag (3–30 letters, numbers, dots, hyphens, or underscores)",
    }),
});

/**
 * Validates the Recovery Request ID input.
 */
export const approvalSchema = z.object({
  requestId: z.string().min(1, "Request ID is required"),
});

const recoveryFields = {
  newOwnerAddress: z
    .string()
    .trim()
    .refine(
      (value) =>
        /^0x[a-fA-F0-9]{40}$/.test(value) || /^G[A-Z2-7]{55}$/.test(value),
      "Enter a valid EVM or Stellar wallet address",
    ),
  chain: z.string().trim().min(1, "Select a network"),
};

export const quickRecoverySchema = z.object(recoveryFields);

export const socialRecoverySchema = z.object({
  ...recoveryFields,
  threshold: z
    .number()
    .int("Threshold must be a whole number")
    .min(1, "At least one guardian is required"),
});

// --- Type Inference ---

export type GuardianFormValues = z.infer<typeof guardianSchema>;
export type ApprovalFormValues = z.infer<typeof approvalSchema>;
export type QuickRecoveryFormValues = z.infer<typeof quickRecoverySchema>;
export type SocialRecoveryFormValues = z.infer<typeof socialRecoverySchema>;
