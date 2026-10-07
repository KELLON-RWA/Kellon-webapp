import { FC } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionButtonProps {
  icon: LucideIcon;
  title: string;
  description: string;
  variant?: "primary" | "warning" | "secondary";
  onClick?: () => void;
}

export const ActionButton: FC<ActionButtonProps> = ({
  icon: Icon,
  title,
  description,
  variant = "secondary",
  onClick,
}) => {
  const variants = {
    primary:
      "bg-gradient-to-r from-primary-70 to-primary-60 text-white shadow-lg hover:shadow-xl active:scale-[0.98]",
    warning:
      "bg-orange-10 text-white shadow-lg hover:bg-orange-10/90 hover:shadow-xl active:scale-[0.98]",
    secondary:
      "border border-black/5 bg-white text-black hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-60 dark:text-white dark:hover:bg-secondary-60/50",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative w-full overflow-hidden flex items-center gap-4 rounded-xl p-5 transition-all text-left outline-none cursor-pointer",
        variants[variant],
      )}
    >
      <Icon className="relative z-10 w-6 h-6 shrink-0" />
      <div className="relative z-10 flex flex-col">
        <span className="text-sm font-bold mb-1">{title}</span>
        <span className="text-[11px] opacity-80 leading-tight">
          {description}
        </span>
      </div>
      {(variant === "primary" || variant === "warning") && (
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
      )}
    </button>
  );
};
