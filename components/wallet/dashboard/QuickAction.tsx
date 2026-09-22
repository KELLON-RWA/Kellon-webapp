import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface QuickActionProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}

export default function QuickAction({
  icon,
  label,
  onClick,
}: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full cursor-pointer flex-col items-center text-cryptoNight outline-none dark:text-white md:rounded-lg md:border md:border-black/10 md:bg-white/75 md:p-3 md:text-left md:shadow-sm md:shadow-primary-90/10 md:transition md:duration-300 md:active:scale-98 md:hover:border-black/20 md:hover:bg-primary-99 md:dark:border-white/10 md:dark:bg-secondary-50 md:dark:text-white md:dark:shadow-none md:dark:hover:border-white/20 dark:md:hover:bg-secondary-60/50 min-[1024px]:!p-1.5 lg:p-2.5"
    >
      <div
        className={cn(
          "flex h-16 w-full transform flex-col items-center justify-center space-y-1.5 rounded-xl border border-black/10 bg-white/85 px-1 shadow-sm shadow-primary-90/20 transition-all duration-300 md:transition-none md:duration-0",
          "group-hover:shadow-lg group-active:scale-95 md:h-10 md:w-10 md:rounded-lg md:group-hover:shadow-none min-[1024px]:h-8 min-[1024px]:w-8 lg:h-9 lg:w-9",
          "dark:border-white/10 dark:bg-secondary-50 dark:shadow-none dark:group-hover:border-primary-70/40 md:border-none md:bg-transparent md:shadow-none dark:md:border-none dark:md:bg-transparent",
        )}
      >
        <span className="shrink-0 ">{icon}</span>
        <span className="text-[7px] xs:text-[9px] tracking-tight transition-colors group-hover:text-cryptoNight  dark:group-hover:text-white md:hidden">
          {label}
        </span>
      </div>

      {/* Label for Desktop (Hidden on mobile to keep the mobile UI compact) */}
      <span className="mt-2 hidden text-[11px] font-medium md:block min-[1024px]:mt-0.5 min-[1024px]:text-[10px] lg:text-xs">
        {label}
      </span>
    </button>
  );
}
