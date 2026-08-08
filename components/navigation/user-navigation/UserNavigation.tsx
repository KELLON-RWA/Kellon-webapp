"use client";

import { FC, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerDescription,
} from "@/components/ui/drawer";
import { useTheme } from "next-themes";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ActionToolTip } from "@/components/ActionTooltip";
import { Icons } from "@/components/Icons";
import Slab from "@/components/ui/slab";
import toast from "react-hot-toast";

import { MenuContent } from "./MenuContent";
import Image from "next/image";
import { User } from "@/types/db";

// Modals
import StellarKeyRecoveryModal from "@/components/modals/StellarRecoveryModal";
import TrustedDevicesModal from "@/components/modals/TrustedDevicesModal";
import SocialRecoveryModal from "@/components/modals/social-recovery/SocialRevoveryModal";
import HelpSupportModal from "@/components/modals/HelpSupportModal";
import AppearanceModal from "@/components/modals/AppearanceModal";
import { ModalType } from "./user-navigation-types";

const UserNavigation: FC<{ profile: User }> = ({ profile }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { theme } = useTheme();

  const handleOpenModal = (name: ModalType) => {
    setMenuOpen(false);
    setTimeout(() => setActiveModal(name), 150);
  };

  const handleShare = async () => {
    const shareUrl = "https://kellon.xyz";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Kellon", url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied to clipboard", {
          position: "bottom-center",
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError")
        toast.error("Could not share link");
    }
  };

  const ModalGroup = () => (
    <>
      <StellarKeyRecoveryModal
        isOpen={activeModal === "stellar key recovery"}
        onClose={() => setActiveModal(null)}
      />
      <TrustedDevicesModal
        isOpen={activeModal === "trusted devices"}
        onClose={() => setActiveModal(null)}
        profile={profile}
      />
      <SocialRecoveryModal
        isOpen={activeModal === "social recovery"}
        onClose={() => setActiveModal(null)}
      />
      <HelpSupportModal
        isOpen={activeModal === "help & support"}
        onClose={() => setActiveModal(null)}
      />
      <AppearanceModal
        isOpen={activeModal === "appearance"}
        onClose={() => setActiveModal(null)}
      />
    </>
  );

  const commonContentProps = {
    profile,
    theme,
    onOpenModal: handleOpenModal,
    onShare: handleShare,
    onCloseMenu: () => setMenuOpen(false),
  };

  if (isMobile) {
    return (
      <>
        <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
          <DrawerTrigger asChild>
            <div className="text-gray-20 dark:text-gray-40 hover:text-black dark:hover:text-white capitalize text-xs font-medium cursor-pointer">
              <Slab href="" className="invisible" />
              <div className="py-4 flex flex-col space-y-1 items-center">
                <Icons.Account className="h-4 w-4" />
                <span>Account</span>
              </div>
            </div>
          </DrawerTrigger>
          <DrawerContent className="max-h-[96vh] rounded-t-[32px] border-none bg-gray-70 outline-none dark:bg-black2 [&>button]:hidden">
            <DrawerHeader className="grid grid-cols-3 items-center border-b border-black/5 dark:border-white/10 pb-4 px-4">
              <div className="flex justify-start">
                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-2 bg-white dark:bg-secondary-60/50 rounded-full border border-slate-200 dark:border-none cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-white" />
                </button>
              </div>
              <DrawerTitle className="text-lg font-bold text-black dark:text-white text-center">
                Account
              </DrawerTitle>
              <div className="w-9" aria-hidden="true" />
              <DrawerDescription className="sr-only">
                Manage settings.
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-2 pb-10">
              <MenuContent {...commonContentProps} />
            </div>
          </DrawerContent>
        </Drawer>
        <ModalGroup />
      </>
    );
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
        <ActionToolTip
          label="Open account menu"
          side="bottom"
          align="end"
          disabled={menuOpen}
        >
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 outline-none pr-3 rounded-full group cursor-pointer transition-colors">
              <div className="w-10 h-10 rounded-full bg-primary-95 dark:bg-primary-70 flex items-center justify-center overflow-hidden border border-gray-80 dark:border-white group-hover:border-primary-50">
                {profile?.image ? (
                  <Image
                    src={profile.image}
                    alt="User"
                    width={40}
                    height={40}
                  />
                ) : (
                  <span className="text-sm text-primary-50 dark:text-white font-bold">
                    {profile?.name?.charAt(0).toUpperCase() || "?"}
                  </span>
                )}
              </div>
            </button>
          </DropdownMenuTrigger>
        </ActionToolTip>
        <DropdownMenuContent
          className="w-92 bg-white dark:bg-secondary-50 border-gray-80 dark:border-secondary-40 p-1 shadow-2xl max-h-[90dvh] overflow-y-auto"
          align="end"
        >
          <MenuContent {...commonContentProps} />
        </DropdownMenuContent>
      </DropdownMenu>
      <ModalGroup />
    </>
  );
};

export default UserNavigation;
