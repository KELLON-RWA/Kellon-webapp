"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { User } from "@/types/db";
import RecoveryAccessSection from "./RecoveryAccessSection";
import SecurityTips from "./SecurityTips";
import VerificationMethodsSection from "./VerificationMethodsSection";
import DisableSecurityMethodModal from "./modals/DisableSecurityMethodModal";
import SecurityIntegrationModals from "./modals/SecurityIntegrationModals";
import SecurityMethodSetupModal from "./modals/SecurityMethodSetupModal";
import { useSecuritySettings } from "./useSecuritySettings";

export default function SecuritySettingsPage({ profile }: { profile: User }) {
  const security = useSecuritySettings();

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-2xl px-6 pb-24 pt-5 md:pt-20">
      <header className="mb-8 flex items-center justify-between">
        <Link
          href="/"
          aria-label="Back to wallet"
          className="cursor-pointer rounded-full border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-100 dark:border-white/10 dark:bg-secondary-60/50 dark:text-white dark:hover:bg-secondary-60"
        >
          <ArrowLeft className="h-6 w-6" />
        </Link>
        <h1 className="text-lg font-semibold text-cryptoNight dark:text-white">
          Security &amp; Backup
        </h1>
        <div className="w-10" aria-hidden="true" />
      </header>

      <VerificationMethodsSection
        settings={security.settings}
        isLoading={security.isLoading}
        isBusy={security.isBusy}
        onOtpChange={security.changeOtp}
        onTotpChange={security.changeTotp}
        onBiometricsChange={security.changeBiometrics}
      />
      <RecoveryAccessSection onSelect={security.setIntegrationModal} />
      <SecurityTips />

      <SecurityMethodSetupModal
        setup={security.setup}
        isBusy={security.isBusy}
        isSubmitting={security.isSubmittingSetup}
        onClose={security.closeSetup}
        onSubmit={security.submitSetup}
      />
      <DisableSecurityMethodModal
        action={security.disableAction}
        isBusy={security.isBusy}
        onClose={security.closeDisable}
        onConfirm={security.confirmDisable}
      />
      <SecurityIntegrationModals
        activeModal={security.integrationModal}
        profile={profile}
        onClose={() => security.setIntegrationModal(null)}
      />
    </main>
  );
}
