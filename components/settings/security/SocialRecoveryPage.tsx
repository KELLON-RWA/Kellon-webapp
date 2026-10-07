"use client";

import { useRouter } from "next/navigation";
import { MainView } from "@/components/modals/social-recovery/MainView";
import { ManageGuardiansView } from "@/components/modals/social-recovery/ManageGuardianView";
import FlowHeader from "@/components/wallet/shared/FlowHeader";
import { useSocialRecovery } from "@/hooks/use-social-recovery";

export default function SocialRecoveryPage() {
  const router = useRouter();
  const recovery = useSocialRecovery(true);

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-2xl px-6 pb-10 pt-5 text-slate-900 transition-colors duration-300 dark:text-white md:pt-20">
      <FlowHeader
        title={
          recovery.currentView === "main" ? "Social Recovery" : "Guardians"
        }
        onBack={
          recovery.currentView === "main"
            ? () => router.push("/settings/security")
            : () => recovery.setCurrentView("main")
        }
        backLabel={
          recovery.currentView === "main"
            ? "Back to security settings"
            : "Back to social recovery"
        }
        className="mb-8"
      />
      {recovery.currentView === "main" ? (
        <MainView
          onClose={() => router.push("/settings/security")}
          onNavigate={() => recovery.setCurrentView("manage-guardians")}
          hideHeader
          approvalForm={recovery.approvalForm}
          quickRecoveryForm={recovery.quickRecoveryForm}
          socialRecoveryForm={recovery.socialRecoveryForm}
          recoveryRequests={recovery.recoveryRequests}
          pendingApprovals={recovery.pendingApprovals}
          onApprove={recovery.handleApproveRequest}
          onQuickRecovery={recovery.handleQuickRecovery}
          onInitiateRecovery={recovery.handleInitiateRecovery}
          onExecuteRecovery={recovery.handleExecuteRecovery}
        />
      ) : (
        <ManageGuardiansView
          onBack={() => recovery.setCurrentView("main")}
          hideHeader
          activeTab={recovery.activeTab}
          setActiveTab={recovery.setActiveTab}
          myGuardians={recovery.myGuardians}
          guardianFor={recovery.guardianFor}
          isLoading={recovery.isLoading}
          guardianForm={recovery.guardianForm}
          onAddGuardian={recovery.handleAddGuardian}
          onAcceptInvite={recovery.handleAcceptInvite}
          onRemoveGuardian={recovery.handleRemoveGuardian}
        />
      )}
    </main>
  );
}
