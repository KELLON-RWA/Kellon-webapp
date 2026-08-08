import type { User } from "@/types/db";
import StellarKeyRecoveryModal from "@/components/modals/StellarRecoveryModal";
import TrustedDevicesModal from "@/components/modals/TrustedDevicesModal";
import SocialRecoveryModal from "@/components/modals/social-recovery/SocialRevoveryModal";
import type { IntegrationModal } from "../security-types";

interface SecurityIntegrationModalsProps {
  activeModal: IntegrationModal;
  profile: User;
  onClose: () => void;
}

export default function SecurityIntegrationModals({
  activeModal,
  profile,
  onClose,
}: SecurityIntegrationModalsProps) {
  return (
    <>
      <StellarKeyRecoveryModal
        isOpen={activeModal === "stellar"}
        onClose={onClose}
      />
      <TrustedDevicesModal
        isOpen={activeModal === "devices"}
        onClose={onClose}
        profile={profile}
      />
      <SocialRecoveryModal
        isOpen={activeModal === "social"}
        onClose={onClose}
      />
    </>
  );
}
