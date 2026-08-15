"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FlowHeaderAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

interface FlowHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  backHref?: string;
  backLabel?: string;
  onClose?: () => void;
  closeLabel?: string;
  rightAction?: FlowHeaderAction;
  rightContent?: ReactNode;
  headingLevel?: "h1" | "h2";
  className?: string;
}

const actionClassName =
  "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-gray-100 text-slate-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-transparent dark:bg-secondary-60/50 dark:text-white dark:hover:bg-secondary-60";

export function FlowHeaderActionButton({
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(actionClassName, className)}
      {...props}
    />
  );
}

export default function FlowHeader({
  title,
  subtitle,
  onBack,
  backHref,
  backLabel = "Go back",
  onClose,
  closeLabel = "Close flow",
  rightAction,
  rightContent,
  headingLevel = "h1",
  className,
}: FlowHeaderProps) {
  const Heading = headingLevel;
  const backButton = (
    <span className={actionClassName}>
      <ArrowLeft className="h-5 w-5" />
    </span>
  );

  return (
    <header
      className={cn(
        "grid grid-cols-[minmax(2.25rem,1fr)_auto_minmax(2.25rem,1fr)] items-center gap-3",
        className,
      )}
    >
      <div className="justify-self-start">
        {backHref ? (
          <Link href={backHref} aria-label={backLabel}>
            {backButton}
          </Link>
        ) : (
          <FlowHeaderActionButton
            aria-label={backLabel}
            onClick={onBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </FlowHeaderActionButton>
        )}
      </div>

      <div className="min-w-0 text-center">
        <Heading className="truncate text-lg font-bold text-black dark:text-white">
          {title}
        </Heading>
        {subtitle ? <div className="mt-0.5">{subtitle}</div> : null}
      </div>

      <div className="justify-self-end">
        {rightContent ??
          (rightAction ? (
            <FlowHeaderActionButton
              aria-label={rightAction.label}
              onClick={rightAction.onClick}
              disabled={rightAction.disabled}
              className={rightAction.className}
            >
              {rightAction.icon}
            </FlowHeaderActionButton>
          ) : onClose ? (
            <FlowHeaderActionButton
              aria-label={closeLabel}
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </FlowHeaderActionButton>
          ) : (
            <span className="block h-9 w-9" aria-hidden="true" />
          ))}
      </div>
    </header>
  );
}
