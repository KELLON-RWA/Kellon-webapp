import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FlowActionFooterProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  helperText?: ReactNode;
  className?: string;
  innerClassName?: string;
  buttonClassName?: string;
  textClassName?: string;
  sticky?: boolean;
  type?: "button" | "submit";
  showShimmer?: boolean;
}

export default function FlowActionFooter({
  children,
  onClick,
  disabled,
  helperText,
  className,
  innerClassName,
  buttonClassName,
  textClassName,
  sticky = true,
  type = "button",
  showShimmer = true,
}: FlowActionFooterProps) {
  return (
    <div
      className={cn(
        sticky &&
          "sticky bottom-0 left-0 right-0 mt-auto bg-transparent border-none pb-4 pt-2 md:pt-4 md:pb-0 pointer-events-auto",
        className,
      )}
    >
      <div className={cn("mx-auto w-full max-w-md md:max-w-full", innerClassName)}>
        <Button
          type={type}
          variant="flow"
          size="flow"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            disabled && "from-gray-400 to-gray-500 opacity-60",
            buttonClassName,
          )}
        >
          <span
            className={cn(
              "relative z-10 flex items-center justify-center gap-2 text-sm font-semibold xs:text-base",
              textClassName,
            )}
          >
            {children}
          </span>
          {showShimmer && !disabled ? (
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
          ) : null}
        </Button>

        {helperText ? (
          <p className="mt-3 px-4 text-center text-[11px] leading-relaxed text-gray-400">
            {helperText}
          </p>
        ) : null}
      </div>
    </div>
  );
}
