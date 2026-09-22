"use client";

import type { User } from "@/types/db";
import FlowHeader from "@/components/wallet/shared/FlowHeader";
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
      <FlowHeader
        title="Security & Backup"
        backHref="/"
        backLabel="Back to wallet"
        className="mb-8"
      />

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
        onRequestCode={security.requestDisableCode}
      />
      <SecurityIntegrationModals
        activeModal={security.integrationModal}
        profile={profile}
        onClose={() => security.setIntegrationModal(null)}
      />
    </main>
  );
}
