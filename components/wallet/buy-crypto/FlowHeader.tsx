"use client";

import { ArrowLeft, X } from "lucide-react";
import { Step, STEP_TITLES } from "@/types/buy-crypto";

interface FlowHeaderProps {
  localStep: Step;
  onBack: () => void;
  onClose: (started: boolean) => void;
}

export default function FlowHeader({
  localStep,
  onBack,
  onClose,
}: FlowHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8 px-4 pt-4">
      <button
        type="button"
        aria-label="Go back"
        onClick={onBack}
        className="p-2 bg-gray-100 dark:bg-secondary-60/50 rounded-full border border-slate-200 dark:border-none
          hover:bg-gray-200 dark:hover:bg-secondary-60 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-white" />
      </button>

      <div className="flex flex-col items-center">
        <h2 className="text-lg font-bold text-black dark:text-white">
          {STEP_TITLES[localStep]}
        </h2>
      </div>

      <button
        type="button"
        aria-label="Close buy flow"
        onClick={() => onClose(true)}
        className="p-2 bg-gray-100 dark:bg-secondary-60/50 rounded-full border border-slate-200 dark:border-none
          hover:bg-gray-200 dark:hover:bg-secondary-60 transition-colors cursor-pointer"
      >
        <X className="w-5 h-5 text-slate-600 dark:text-white" />
      </button>
    </div>
  );
}
