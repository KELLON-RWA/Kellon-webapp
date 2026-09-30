"use client";

import { FC, useEffect } from "react";
import {
  HelpCircle,
  ArrowLeft,
  Mail,
  MessageCircle,
  ChevronRight,
  LucideIcon,
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
import { useMediaQuery } from "@/hooks/use-media-query";

// Custom X (formerly Twitter) Icon Component
const XIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={className}
    fill="currentColor"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface SupportItemProps {
  icon: LucideIcon | FC<{ className?: string }>;
  title: string;
  subtitle: string;
  href: string;
  isCustomIcon?: boolean;
}

const SupportItem: FC<SupportItemProps> = ({
  icon: Icon,
  title,
  subtitle,
  href,
  isCustomIcon,
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="w-full flex items-center justify-between p-5 rounded-[24px] bg-white dark:bg-secondary-60 border border-black/5 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-secondary-60/50 transition-all group outline-none cursor-pointer"
  >
    <div className="flex items-center gap-4">
      <div className="p-2 bg-pink-500/10 dark:bg-pink-500/20 rounded-lg text-[#D64692]">
        {/* Render as a component if it's a Lucide icon, or directly if it's our custom SVG */}
        {isCustomIcon ? (
          <Icon className="w-5 h-5" />
        ) : (
          <Icon className="w-5 h-5" />
        )}
      </div>
      <div className="flex flex-col text-left">
        <span className="text-sm font-bold text-black dark:text-white leading-tight">
          {title}
        </span>
        <span className="text-[11px] text-gray-20 dark:text-secondary-90 font-medium mt-0.5">
          {subtitle}
        </span>
      </div>
    </div>
    <ChevronRight className="w-4 h-4 text-gray-30 transition-colors group-hover:text-black dark:group-hover:text-white" />
  </a>
);

interface HelpSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpSupportModal: FC<HelpSupportModalProps> = ({ isOpen, onClose }) => {
  const isMobile = useMediaQuery("(max-width: 768px)");

  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        document.body.style.pointerEvents = "auto";
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const Content = () => (
    <div className="px-4 pb-8 md:pb-0">
      <div className="flex justify-start mb-4">
        <button
          onClick={onClose}
          className="p-2 bg-white dark:bg-secondary-60/50 rounded-full border border-black/5 dark:border-none hover:opacity-80 transition-opacity outline-none cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-white" />
        </button>
      </div>

      <div className="flex flex-col items-center justify-center space-y-4 mb-8">
        <div className="p-4 bg-primary-95 dark:bg-primary-70/10 rounded-full">
          <HelpCircle className="w-10 h-10 text-primary-70" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-black dark:text-white">
            Help & Support
          </h2>
          <p className="text-sm text-gray-20 dark:text-secondary-90 max-w-[240px] mx-auto leading-relaxed">
            Need assistance? Our support team is here to help you 24/7.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <SupportItem
          icon={Mail}
          title="Email Support"
          subtitle="support@kellon.xyz"
          href="mailto:support@kellon.xyz"
        />
        <SupportItem
          icon={MessageCircle}
          title="Discord Community"
          subtitle="discord.gg/kellon"
          href="https://discord.gg/kellon"
        />
        {/* Updated: Twitter -> X */}
        <SupportItem
          icon={XIcon}
          title="X Updates"
          subtitle="@KellonApp"
          href="https://x.com/KellonApp"
          isCustomIcon
        />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onClose}>
        <DrawerContent className="rounded-t-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 outline-none dark:bg-none dark:bg-black2 [&>button]:hidden">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Help & Support</DrawerTitle>
            <DrawerDescription>
              Get in touch with the Kellon team
            </DrawerDescription>
          </DrawerHeader>
          <Content />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 outline-none dark:bg-none dark:bg-black2 sm:max-w-md [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Help & Support</DialogTitle>
          <DialogDescription>
            Get in touch with the Kellon team
          </DialogDescription>
        </DialogHeader>
        <Content />
      </DialogContent>
    </Dialog>
  );
};

export default HelpSupportModal;
