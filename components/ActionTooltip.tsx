"use client";

import React, { FC } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ActionTooltipProps {
  label: string;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  disabled?: boolean;
}

export const ActionToolTip: FC<ActionTooltipProps> = ({
  label,
  children,
  side,
  align,
  disabled,
}) => {
  if (disabled) return <>{children}</>;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={50}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className="mt-2 border border-black/10 bg-cryptoNight px-2 py-1 shadow-sm dark:border-white/10 dark:bg-secondary-60"
        >
          <p className="text-[10px] font-semibold leading-none text-white">
            {label}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
