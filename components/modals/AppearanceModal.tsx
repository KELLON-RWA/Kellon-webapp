"use client";

import { FC } from "react";
import { useTheme } from "next-themes";
// IMP START - Updated imports to include ArrowLeft and remove X
import {
  ArrowLeft,
  Info,
  Sun,
  Moon,
  Monitor,
  CheckCircle2,
  LucideIcon,
} from "lucide-react";
// IMP END - Updated imports
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

interface AppearanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AppearanceModal: FC<AppearanceModalProps> = ({ isOpen, onClose }) => {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const { theme, setTheme } = useTheme();

  const ThemeOption = ({
    id,
    title,
    description,
    icon: Icon,
  }: {
    id: string;
    title: string;
    description: string;
    icon: LucideIcon;
  }) => {
    const isActive = theme === id;

    return (
      <button
        onClick={() => setTheme(id)}
        className={cn(
          "w-full flex cursor-pointer items-center justify-between rounded-[24px] border p-5 text-left mb-3 outline-none transition-all group",
          isActive
            ? "border-primary-70 bg-primary-70/5 dark:bg-primary-70/10"
            : "border-black/5 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-60 dark:hover:bg-secondary-60/50",
        )}
      >
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "p-3 rounded-xl",
              isActive
                ? "bg-primary-70 text-white"
                : "bg-gray-95 dark:bg-secondary-40 text-gray-30 dark:text-white",
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-black dark:text-white">
              {title}
            </span>
            <span className="text-[11px] text-gray-20 dark:text-secondary-90">
              {description}
            </span>
          </div>
        </div>
        {isActive && (
          <CheckCircle2 className="w-5 h-5 text-primary-70 fill-primary-70/20" />
        )}
      </button>
    );
  };

  const Content = () => (
    // IMP START - Updated padding to accommodate top back button
    <div className="px-6 pb-8 md:pb-0 h-full flex flex-col items-center">
      {/* IMP END - Updated padding */}

      {/* IMP START - Integrated circular Back Button layout */}
      <div className="w-full flex justify-start mb-4">
        <button
          onClick={onClose}
          className="p-2 bg-white dark:bg-secondary-60/50 rounded-full border border-black/5 dark:border-none hover:opacity-80 transition-opacity outline-none cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-white" />
        </button>
      </div>
      {/* IMP END - Back Button */}

      {/* Header Icon */}
      <div className="w-16 h-16 bg-primary-70/10 rounded-full flex items-center justify-center mb-4 mt-2">
        <Info className="w-8 h-8 text-primary-70 fill-primary-70/20" />
      </div>

      <h2 className="text-xl font-bold text-black dark:text-white mb-2">
        Appearance
      </h2>
      <p className="text-sm text-gray-20 dark:text-secondary-90 mb-8">
        Choose your preferred theme.
      </p>

      {/* Options List */}
      <div className="w-full">
        <ThemeOption
          id="system"
          title="Use Device Setting"
          description="Automatically match your device theme"
          icon={Monitor}
        />
        <ThemeOption
          id="light"
          title="Light Mode"
          description="Bright interface with high contrast"
          icon={Sun}
        />
        <ThemeOption
          id="dark"
          title="Dark Mode"
          description="Dimmed interface for low-light environments"
          icon={Moon}
        />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onClose}>
        {/* IMP START - Drawer padding/max-h update matching SocialRecovery */}
        <DrawerContent className="max-h-[92vh] rounded-t-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 outline-none dark:bg-none dark:bg-black2 [&>button]:hidden">
          {/* IMP END - Drawer update */}
          <DrawerHeader className="sr-only">
            <DrawerTitle>Appearance</DrawerTitle>
          </DrawerHeader>
          <Content />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* IMP START - Dialog structure update removing top-right X and matching SocialRecovery */}
      <DialogContent className="overflow-hidden rounded-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 p-0 outline-none dark:bg-none dark:bg-black2 sm:max-w-md [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DrawerTitle>Appearance</DrawerTitle>
        </DialogHeader>
        <div className="py-6 relative">
          {/* Top-right X button removed from here */}
          <Content />
        </div>
      </DialogContent>
      {/* IMP END - Dialog structure update */}
    </Dialog>
  );
};

export default AppearanceModal;
