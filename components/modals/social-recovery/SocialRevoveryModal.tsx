"use client";

import { FC, useEffect } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useSocialRecovery } from "@/hooks/use-social-recovery";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { MainView } from "./MainView";
import { ManageGuardiansView } from "./ManageGuardianView";

// Modular Components

interface SocialRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SocialRecoveryModal: FC<SocialRecoveryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const isMobile = useMediaQuery("(max-width: 768px)");

  // All logic (state, forms, API calls) is encapsulated here
  const {
    currentView,
    setCurrentView,
    activeTab,
    setActiveTab,
    myGuardians,
    guardianFor,
    isLoading,
    guardianForm,
    approvalForm,
    handleAddGuardian,
    handleApproveRequest,
    handleAcceptInvite,
  } = useSocialRecovery(isOpen);

  // Reset view when modal closes
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => setCurrentView("main"), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, setCurrentView]);

  const renderContent = () =>
    currentView === "main" ? (
      <MainView
        onClose={onClose}
        onNavigate={() => setCurrentView("manage-guardians")}
        approvalForm={approvalForm}
        onApprove={handleApproveRequest}
      />
    ) : (
      <ManageGuardiansView
        onBack={() => setCurrentView("main")}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        myGuardians={myGuardians}
        guardianFor={guardianFor}
        isLoading={isLoading}
        guardianForm={guardianForm}
        onAddGuardian={handleAddGuardian}
        onAcceptInvite={handleAcceptInvite}
      />
    );

  // Shared Accessibility Props
  const srContent = (
    <>
      <DialogHeader className="sr-only">
        <DialogTitle>Social Recovery</DialogTitle>
        <DialogDescription>
          Manage your trusted guardians and account recovery requests.
        </DialogDescription>
      </DialogHeader>
      <div className="overflow-y-auto custom-scrollbar pt-4 max-h-[90vh]">
        {renderContent()}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onClose}>
        <DrawerContent className="rounded-t-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 outline-none dark:bg-none dark:bg-black2 [&>button]:hidden">
          {srContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="overflow-hidden rounded-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 p-0 outline-none dark:bg-none dark:bg-black2 sm:max-w-md [&>button]:hidden">
        {srContent}
      </DialogContent>
    </Dialog>
  );
};

export default SocialRecoveryModal;
