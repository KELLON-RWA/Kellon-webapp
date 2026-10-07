"use client";

import { FC, useEffect, useState } from "react";
import {
  Key,
  Copy,
  AlertTriangle,
  Eye,
  EyeOff,
  Info,
  ArrowLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import TransferVerificationModal from "@/components/wallet/send/TransferVerificationModal";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  exportWalletPrivateKey,
  type ExportedWalletPrivateKey,
} from "@/services/api/user";
import { securityService } from "@/services/api/security";
import {
  getAvailableVerificationMethods,
  getOtpChannelForMethod,
  TransferVerificationRequiredError,
  type VerificationMethod,
} from "@/services/api/transfers";

interface StellarKeyRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const StellarKeyRecoveryModal: FC<StellarKeyRecoveryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [exportedAccount, setExportedAccount] =
    useState<ExportedWalletPrivateKey | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [verificationType, setVerificationType] =
    useState<VerificationMethod | null>(null);
  const [verificationMethods, setVerificationMethods] = useState<
    VerificationMethod[]
  >([]);
  const [otpSent, setOtpSent] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  useEffect(() => {
    if (!isOpen) {
      setIsRevealed(false);
      setExportedAccount(null);
      setVerificationType(null);
      setVerificationMethods([]);
      setOtpSent(false);
    }
  }, [isOpen]);

  const copyToClipboard = async (): Promise<void> => {
    if (!exportedAccount?.privateKey) return;

    try {
      await navigator.clipboard.writeText(exportedAccount.privateKey);
      toast.success("Secret key copied to clipboard");
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      toast.error("Failed to copy key");
    }
  };

  const requestKey = async (verification?: {
    code: string;
    type: VerificationMethod;
  }) => {
    setIsExporting(true);

    try {
      const response = await exportWalletPrivateKey("stellar", {
        verificationCode: verification?.code,
        verificationType: verification?.type,
      });
      setExportedAccount(response.data);
      setIsRevealed(true);
      setVerificationType(null);
      setVerificationMethods([]);
      setOtpSent(false);
    } catch (error) {
      if (error instanceof TransferVerificationRequiredError) {
        const methods = getAvailableVerificationMethods(
          error.availableMethods,
          error.verificationType,
        );
        const selectedMethod = methods.includes(error.verificationType)
          ? error.verificationType
          : methods[0];

        setVerificationMethods(methods);
        setVerificationType(selectedMethod);
        setOtpSent(true);
        return;
      }

      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to reveal recovery key",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const requestVerificationCode = async () => {
    if (!verificationType) return;

    const channel = getOtpChannelForMethod(verificationType);
    if (!channel) return;

    setIsRequestingOtp(true);
    try {
      await securityService.requestOtp(channel, "security");
      setOtpSent(true);
      toast.success(
        `Verification code sent by ${channel === "sms" ? "SMS" : "email"}.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to send verification code",
      );
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const revealKey = () => {
    if (exportedAccount?.privateKey) {
      setIsRevealed(true);
      return;
    }

    void requestKey();
  };

  const Content = () => (
    <div className="px-4 pb-8 md:pb-0">
      {/* Custom Back/Close Button */}
      <div className="flex justify-start mb-4">
        <button
          onClick={onClose}
          className="p-2 bg-white dark:bg-secondary-60/50 rounded-full border border-black/5 dark:border-none hover:opacity-80 transition-opacity outline-none cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-white" />
        </button>
      </div>

      <div className="flex flex-col items-center justify-center space-y-3 mb-6">
        <div className="p-3 bg-primary-95 dark:bg-primary-70/10 rounded-full">
          <Key className="w-8 h-8 text-primary-70" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-black dark:text-white">
            Recovery Key
          </h2>
          <p className="text-sm text-gray-20 dark:text-secondary-90 max-w-[280px] mx-auto">
            Your recovery key (Secret Seed) is the only way to recover your
            account if you lose access to this device.
          </p>
        </div>
      </div>

      <div className="relative group overflow-hidden bg-white dark:bg-secondary-60 border border-black/5 dark:border-white/10 rounded-[24px] p-6 min-h-[140px] flex flex-col items-center justify-center">
        {!isRevealed || !exportedAccount ? (
          <button
            onClick={revealKey}
            disabled={isExporting}
            className="flex flex-col items-center gap-2 text-primary-70 hover:opacity-80 transition-opacity cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="text-2xl tracking-widest font-bold">
              ••••••••••••
            </span>
            <span className="text-sm font-bold flex items-center gap-2">
              <Eye className="w-4 h-4" />
              {isExporting ? "Verifying..." : "Reveal Key"}
            </span>
          </button>
        ) : (
          <div className="w-full space-y-4 animate-in fade-in zoom-in duration-300">
            <p className="text-sm font-mono break-all text-center text-black dark:text-white px-2">
              {exportedAccount.privateKey}
            </p>
            <div className="flex justify-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsRevealed(false)}
                className="text-xs"
              >
                <EyeOff className="w-3 h-3 mr-1" /> Hide
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={copyToClipboard}
                className="text-xs text-primary-70 cursor-copy"
              >
                <Copy className="w-3 h-3 mr-1" /> Copy
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-start gap-3 justify-center text-orange-600 dark:text-orange-400">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <p className="text-xs font-medium">
          Store this key in a safe, offline location.
        </p>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-80 dark:border-secondary-40 text-center">
        <div className="flex items-center justify-center gap-2 mb-4 text-gray-20 dark:text-secondary-90">
          <Info className="w-4 h-4" />
          <p className="text-[10px] max-w-[240px]">
            For Smart Accounts (ERC-4337), please use the Social Recovery
            dashboard in settings to manage your guardians and recover your
            account.
          </p>
        </div>
        <Button onClick={onClose} variant="flow" size="flow">
          <span className="relative z-10">I&apos;ve saved it securely</span>
          <span className="absolute inset-0 bg-gradient-to-r from-primary-60 to-primary-50 opacity-0 transition-opacity group-hover:opacity-100" />
        </Button>
      </div>
    </div>
  );

  const verificationModal = (
    <TransferVerificationModal
      isOpen={Boolean(verificationType)}
      isSubmitting={isExporting}
      verificationType={verificationType || "email_otp"}
      title="Verify recovery key"
      actionNoun="reveal your recovery key"
      description={
        verificationType === "totp"
          ? "Enter your authenticator code to reveal your recovery key."
          : "Enter the verification code sent to authorize revealing your recovery key."
      }
      selectedMethod={verificationType || "email_otp"}
      availableMethods={verificationMethods}
      onMethodChange={(method) => {
        setVerificationType(method);
        setOtpSent(method === "totp");
      }}
      otpSent={otpSent}
      onResend={() => void requestVerificationCode()}
      isResending={isRequestingOtp}
      onClose={() => {
        setVerificationType(null);
        setVerificationMethods([]);
        setOtpSent(false);
      }}
      onSubmit={(code) => {
        if (verificationType) {
          void requestKey({ code, type: verificationType });
        }
      }}
    />
  );

  if (isMobile) {
    return (
      <>
        <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
          <DrawerContent className="rounded-t-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 outline-none dark:bg-none dark:bg-black2 [&>button]:hidden">
            <DrawerHeader className="sr-only">
              <DrawerTitle>Stellar Key Recovery</DrawerTitle>
              <DrawerDescription>
                View and save your recovery seed phrase.
              </DrawerDescription>
            </DrawerHeader>
            <Content />
          </DrawerContent>
        </Drawer>
        {verificationModal}
      </>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="rounded-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 outline-none dark:bg-none dark:bg-black2 sm:max-w-md [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Stellar Key Recovery</DialogTitle>
            <DialogDescription>
              View and save your recovery seed phrase.
            </DialogDescription>
          </DialogHeader>
          <Content />
        </DialogContent>
      </Dialog>
      {verificationModal}
    </>
  );
};

export default StellarKeyRecoveryModal;
