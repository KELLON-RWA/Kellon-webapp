import type {
  VerificationMethod,
  VerificationType,
} from "@/services/api/transfers";

export type SwapVerification = {
  availableMethods: VerificationMethod[];
  selectedMethod: VerificationMethod;
  verificationType: VerificationType;
  action?: string;
  otpSent: boolean;
};

export type SwapSmartAccountClient = {
  account: { address?: string };
  chain: unknown;
  sendTransaction(args: {
    account: unknown;
    chain: unknown;
    calls: Array<{ to: `0x${string}`; data?: `0x${string}`; value?: bigint }>;
  }): Promise<string>;
};
