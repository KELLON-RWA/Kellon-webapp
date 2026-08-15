import type { VerificationMethod } from "@/services/api/transfers";

export type BridgeVerification = {
  availableMethods: VerificationMethod[];
  selectedMethod: VerificationMethod;
  verificationType: "otp" | "totp";
  action?: string;
  otpSent: boolean;
};

export type EvmSmartAccountClient = {
  account: { address?: string };
  chain: unknown;
  sendTransaction(args: {
    account: unknown;
    chain: unknown;
    calls: Array<{ to: `0x${string}`; data?: `0x${string}`; value?: bigint }>;
  }): Promise<string>;
};
