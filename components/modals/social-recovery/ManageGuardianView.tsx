"use client";

import { FC } from "react";
import { ArrowLeft, Plus, Loader2, Users } from "lucide-react";
import { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Guardian } from "@/types/db";
import { cn } from "@/lib/utils";
import { GuardianFormValues } from "@/lib/validations/social-recovery";
import { GuardianListItem } from "./GuardianListItem";

interface ManageGuardiansViewProps {
  onBack: () => void;
  hideHeader?: boolean;
  activeTab: "my-guardians" | "guardian-for";
  setActiveTab: (tab: "my-guardians" | "guardian-for") => void;
  myGuardians: Guardian[];
  guardianFor: Guardian[];
  isLoading: boolean;
  guardianForm: UseFormReturn<GuardianFormValues>;
  onAddGuardian: (values: GuardianFormValues) => Promise<void>;
  onAcceptInvite: (userId: string) => Promise<void>;
  onRemoveGuardian: (guardianId: string) => Promise<void>;
}

export const ManageGuardiansView: FC<ManageGuardiansViewProps> = ({
  onBack,
  hideHeader = false,
  activeTab,
  setActiveTab,
  myGuardians,
  guardianFor,
  isLoading,
  guardianForm,
  onAddGuardian,
  onAcceptInvite,
  onRemoveGuardian,
}) => {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = guardianForm;

  return (
    <div className={cn("h-full", hideHeader ? "pb-0" : "px-4 pb-8")}>
      {!hideHeader && (
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={onBack}
            className="p-2 bg-white dark:bg-secondary-60/50 rounded-full border border-black/5 dark:border-none hover:opacity-80 transition-opacity outline-none cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-white" />
          </button>
          <h2 className="text-xl font-bold text-black dark:text-white">
            Guardians
          </h2>
          <div className="w-9" />
        </div>
      )}

      {/* Tabs logic remains the same... */}
      <div className="flex border-b border-black/5 dark:border-white/10 mb-6">
        {(["my-guardians", "guardian-for"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "cursor-pointer",
              "flex-1 pb-3 text-sm font-bold capitalize transition-all",
              activeTab === tab
                ? "text-primary-20 border-b-2 border-primary-20"
                : "text-gray-20 dark:text-secondary-90",
            )}
          >
            {tab.replace("-", " ")}
          </button>
        ))}
      </div>

      {activeTab === "my-guardians" ? (
        <div className="animate-in fade-in slide-in-from-right-2 duration-300">
          <p className="text-[13px] text-gray-20 dark:text-secondary-90 mb-6">
            Add trusted contacts who can help you recover your account.
          </p>

          <form
            onSubmit={handleSubmit(onAddGuardian)}
            className="bg-white dark:bg-secondary-60 border border-black/5 dark:border-white/10 rounded-[24px] p-5 mb-8"
          >
            <h4 className="text-sm font-bold mb-4 text-black dark:text-white">
              Add New Guardian
            </h4>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                {/* Visual Prefix Container */}
                <div
                  className={cn(
                    "flex flex-1 items-center bg-gray-95 dark:bg-secondary-60 rounded-2xl px-3 border border-black/5 dark:border-white/10 focus-within:ring-[3px] focus-within:ring-primary-70/20 transition-all",
                    errors.guardianId && "border-red-500",
                  )}
                >
                  {/* The @ symbol - stays muted in both modes */}
                  <span className="text-gray-400 dark:text-secondary-90 font-normal mr-[2px] select-none">
                    @
                  </span>

                  <Input
                    {...register("guardianId")}
                    placeholder="enter guardian tag (eg @alice)"
                    className={cn(
                      "bg-transparent dark:bg-transparent",
                      "border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
                      "p-0 h-10 text-sm w-full",
                      "text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-secondary-90/50",
                    )}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  variant="flow"
                  className="h-10 w-10 shrink-0 p-0"
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin w-4 h-4" />
                  ) : (
                    <Plus className="w-5 h-5 text-white" />
                  )}
                </Button>
              </div>
              {errors.guardianId && (
                <p className="text-[10px] text-red-500 font-bold ml-1">
                  {errors.guardianId.message}
                </p>
              )}
            </div>
          </form>

          <div className="space-y-3">
            {isLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary-20" />
              </div>
            ) : myGuardians.length === 0 ? (
              <EmptyState message="No guardians added yet." />
            ) : (
              myGuardians.map((g) => (
                <GuardianListItem
                  key={g.id}
                  id={g.id}
                  label={g.guardian?.name || ""}
                  status={g.status}
                  showRemoveButton
                  onRemove={() => onRemoveGuardian(g.guardianId)}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-left-2 duration-300">
          <p className="text-[13px] text-gray-20 dark:text-secondary-90 mb-8">
            People who have trusted you as a guardian.
          </p>
          <div className="space-y-4">
            {isLoading ? (
              <div className="py-12 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary-20" />
              </div>
            ) : guardianFor.length === 0 ? (
              <EmptyState message="No one has added you as a guardian." />
            ) : (
              guardianFor.map((g) => (
                <GuardianListItem
                  key={g.id}
                  id={g.id}
                  label={`@${g.userId}`}
                  status={g.status}
                  showAcceptButton
                  onAccept={() => onAcceptInvite(g.userId)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="py-12 flex flex-col items-center justify-center opacity-40">
    <Users className="w-12 h-12 mb-2 text-gray-400" />
    <p className="text-sm italic text-gray-500">{message}</p>
  </div>
);
