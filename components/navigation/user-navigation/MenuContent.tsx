import { FC } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Share2,
  MessageSquare,
  Shield,
  FileText,
  Info,
  AlertCircle,
  Pencil,
  ChevronRight,
} from "lucide-react";
import { Icons } from "@/components/Icons";
import Signout from "@/components/auth/Signout";
import NotificationSwitch from "./NotificationSwitch";
import { SectionHeader, NavigationItem, LinkItem } from "./NavItems";
import { User } from "@/types/db";
import { ModalType } from "./user-navigation-types";

interface MenuContentProps {
  profile: User;
  theme: string | undefined;
  onOpenModal: (name: ModalType) => void;
  onShare: () => void;
  onCloseMenu: () => void;
  hideProfile?: boolean;
}

export const MenuContent: FC<MenuContentProps> = ({
  profile,
  theme,
  onOpenModal,
  onShare,
  onCloseMenu,
  hideProfile,
}) => (
  <div className="flex flex-col">
    {!hideProfile && (
      <div className="p-4 flex items-center gap-4">
        <div className="relative shrink-0">
          <div className="w-14 h-14 rounded-full bg-primary-95 dark:bg-primary-70 flex items-center justify-center overflow-hidden border-2 border-white dark:border-secondary-40 shadow-sm">
            {profile?.image ? (
              <Image
                src={profile.image}
                alt={profile.name || "User"}
                width={56}
                height={56}
                className="object-cover w-full h-full"
              />
            ) : (
              <span className="text-lg font-bold text-primary-50 dark:text-white">
                {profile?.name?.charAt(0).toUpperCase() ?? "?"}
              </span>
            )}
          </div>
          <Link
            href="/settings/profile"
            onClick={onCloseMenu}
            className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-primary-70 rounded-full border-2 border-white dark:border-secondary-60 flex items-center justify-center shadow-md hover:bg-primary-60 transition-colors cursor-pointer"
          >
            <Pencil className="w-2.5 h-2.5 text-white" />
          </Link>
        </div>
        <div className="flex flex-col min-w-0">
          <p className="text-sm font-bold text-black dark:text-white truncate">
            {profile?.name ?? "Guest"}
          </p>
          <p className="text-xs text-gray-20 dark:text-secondary-90 truncate">
            {profile?.email ?? "Guest@gmail.com"}
          </p>
          <Link
            href="/settings/profile"
            onClick={onCloseMenu}
            className="text-primary-70 text-[10px] font-bold flex items-center mt-1 group cursor-pointer"
          >
            Edit Profile
            <ChevronRight className="ml-0.5 h-2.5 w-2.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    )}

    <div className="h-[1px] bg-gray-80 dark:bg-secondary-40 my-1" />

    <div className="flex flex-col border rounded-md">
      <SectionHeader label="Security Center" />
      <LinkItem
        icon={<Shield className="w-4 h-4" />}
        label="Security & Backup"
        subLabel="Verification, recovery and trusted devices"
        href="/settings/security"
        onClick={onCloseMenu}
      />
    </div>

    <div className="h-[1px] bg-gray-80 dark:bg-secondary-40 my-1" />

    <div className="flex flex-col border rounded-md">
      <SectionHeader label="Preferences" />
      <NavigationItem
        icon={<Icons.Theme className="w-4 h-4" />}
        label="Appearance"
        subLabel={`Current: ${theme}`}
        onClick={() => onOpenModal("appearance")}
      />
      <NotificationSwitch />
    </div>

    <div className="h-[1px] bg-gray-80 dark:bg-secondary-40 my-1" />

    <div className="flex flex-col border rounded-md">
      <SectionHeader label="Support & Community" />
      <NavigationItem
        icon={<Share2 className="w-4 h-4" />}
        label="Share Kellon"
        onClick={onShare}
      />
      <NavigationItem
        icon={<MessageSquare className="w-4 h-4" />}
        label="Help & Support"
        onClick={() => onOpenModal("help & support")}
      />
    </div>

    <div className="h-[1px] bg-gray-80 dark:bg-secondary-40 my-1" />

    <div className="flex flex-col border rounded-md">
      <SectionHeader label="Legal & Information" />
      <LinkItem
        icon={<Shield className="w-4 h-4" />}
        label="Privacy Policy"
        href="https://www.kellon.xyz/privacy-policy"
      />
      <LinkItem
        icon={<FileText className="w-4 h-4" />}
        label="Terms of Use"
        href="https://www.kellon.xyz/terms-of-use"
      />
      <LinkItem
        icon={<AlertCircle className="w-4 h-4" />}
        label="Disclaimer"
        href="https://www.kellon.xyz/disclaimer"
      />
      <LinkItem
        icon={<Info className="w-4 h-4" />}
        label="About Kellon"
        href="https://www.kellon.xyz/#about"
      />
    </div>

    <div className="h-[1px] bg-gray-80 dark:bg-secondary-40 my-1" />
    <div className="flex justify-center border rounded-md py-2">
      <Signout />
    </div>
  </div>
);
