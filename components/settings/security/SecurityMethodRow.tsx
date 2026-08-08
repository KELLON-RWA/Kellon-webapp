import type { ReactNode } from "react";
import { Switch } from "@/components/ui/switch";

interface SecurityMethodRowProps {
  icon: ReactNode;
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export default function SecurityMethodRow({
  icon,
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: SecurityMethodRowProps) {
  return (
    <div className="flex items-center gap-4 border-b border-black/5 px-4 py-4 last:border-b-0 dark:border-white/10">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-95 text-primary-50 dark:bg-primary-70/15 dark:text-primary-80">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-cryptoNight dark:text-white">
            {title}
          </p>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              checked
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-gray-90 text-gray-30 dark:bg-secondary-60 dark:text-gray-40"
            }`}
          >
            {checked ? "Enabled" : "Off"}
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-gray-20 dark:text-gray-40">
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={`${checked ? "Disable" : "Enable"} ${title}`}
      />
    </div>
  );
}
