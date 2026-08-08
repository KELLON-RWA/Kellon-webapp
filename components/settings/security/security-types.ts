import type { OtpChannel } from "@/services/api/security";

export type IntegrationModal = "stellar" | "devices" | "social" | null;

export type SecuritySetup =
  | { kind: "otp"; channel: OtpChannel; destination?: string }
  | { kind: "totp"; secret: string; qrCodeUrl?: string }
  | null;

export type DisableSecurityAction =
  | { kind: "otp"; channel: OtpChannel; label: string }
  | { kind: "totp"; label: string }
  | { kind: "biometrics"; label: string }
  | null;
