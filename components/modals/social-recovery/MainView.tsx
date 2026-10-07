"use client";

import { FC, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Loader2,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { Path, UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ApprovalFormValues,
  QuickRecoveryFormValues,
  SocialRecoveryFormValues,
} from "@/lib/validations/social-recovery";
import { RecoveryRequest } from "@/services/api/social-recovery";
import { ActionButton } from "./ActionButton";

type RecoveryFlow = "quick" | "social" | null;

interface MainViewProps {
  onClose: () => void;
  onNavigate: () => void;
  hideHeader?: boolean;
  approvalForm: UseFormReturn<ApprovalFormValues>;
  quickRecoveryForm: UseFormReturn<QuickRecoveryFormValues>;
  socialRecoveryForm: UseFormReturn<SocialRecoveryFormValues>;
  recoveryRequests: RecoveryRequest[];
  pendingApprovals: RecoveryRequest[];
  onApprove: (values: ApprovalFormValues) => Promise<void>;
  onQuickRecovery: (values: QuickRecoveryFormValues) => Promise<void>;
  onInitiateRecovery: (values: SocialRecoveryFormValues) => Promise<void>;
  onExecuteRecovery: (requestId: string) => Promise<void>;
}

export const MainView: FC<MainViewProps> = ({
  onClose,
  onNavigate,
  hideHeader = false,
  approvalForm,
  quickRecoveryForm,
  socialRecoveryForm,
  recoveryRequests,
  pendingApprovals,
  onApprove,
  onQuickRecovery,
  onInitiateRecovery,
  onExecuteRecovery,
}) => {
  const [activeFlow, setActiveFlow] = useState<RecoveryFlow>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);

  const handleExecute = async (requestId: string) => {
    setExecutingId(requestId);
    try {
      await onExecuteRecovery(requestId);
    } finally {
      setExecutingId(null);
    }
  };

  return (
    <div
      className={cn(
        "animate-in fade-in duration-300",
        hideHeader ? "pb-0" : "px-4 pb-8",
      )}
    >
      {!hideHeader && (
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={onClose}
            aria-label="Close social recovery"
            className="p-2 bg-white dark:bg-secondary-60/50 rounded-full border border-black/5 dark:border-none hover:opacity-80 transition-opacity outline-none cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-white" />
          </button>
          <h2 className="text-xl font-bold text-black dark:text-white">
            Social Recovery
          </h2>
          <span className="w-9" aria-hidden />
        </div>
      )}

      <div className="bg-white dark:bg-secondary-60 border border-black/5 dark:border-white/10 rounded-2xl p-4 mb-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-green-500" />
        </div>
        <div>
          <p className="text-xs text-gray-20 dark:text-secondary-90">
            Account status
          </p>
          <p className="text-sm font-bold text-black dark:text-white">
            Recovery ready
          </p>
        </div>
      </div>

      <section className="space-y-3 mb-6">
        <p className="px-1 text-sm font-semibold text-black dark:text-white">
          Recover access
        </p>
        <ActionButton
          variant="primary"
          icon={Zap}
          title="Quick recovery"
          description="Recover directly to a new owner address."
          onClick={() => setActiveFlow("quick")}
        />
        <ActionButton
          variant="warning"
          icon={ShieldCheck}
          title="Start social recovery"
          description="Create a request for your guardians to approve."
          onClick={() => setActiveFlow("social")}
        />
        <ActionButton
          variant="secondary"
          icon={Users}
          title="Manage guardians"
          description="Add, accept, or remove trusted contacts."
          onClick={onNavigate}
        />
      </section>

      {activeFlow === "quick" && (
        <RecoveryForm
          title="Quick recovery"
          description="Enter the destination owner address and network for this recovery."
          form={quickRecoveryForm}
          onSubmit={onQuickRecovery}
          onCancel={() => setActiveFlow(null)}
          submitLabel="Recover account"
        />
      )}

      {activeFlow === "social" && (
        <RecoveryForm
          title="Start social recovery"
          description="Your guardians must approve this request before it can be executed."
          form={socialRecoveryForm}
          onSubmit={onInitiateRecovery}
          onCancel={() => setActiveFlow(null)}
          submitLabel="Send recovery request"
          includeThreshold
        />
      )}

      <RequestList
        title="Your recovery requests"
        requests={recoveryRequests}
        emptyMessage="No recovery requests yet."
        actionLabel="Execute"
        actionBusyId={executingId}
        onAction={handleExecute}
      />

      <RequestList
        title="Approvals awaiting you"
        requests={pendingApprovals}
        emptyMessage="No guardian approvals are waiting."
        actionLabel="Approve"
        onAction={async (requestId) => {
          approvalForm.reset({ requestId });
          await onApprove({ requestId });
        }}
      />

      <form
        onSubmit={approvalForm.handleSubmit(onApprove)}
        className="mt-6 bg-white dark:bg-secondary-60 border border-black/5 dark:border-white/10 rounded-2xl p-4 space-y-3"
      >
        <p className="text-sm font-bold text-black dark:text-white">
          Approve with request ID
        </p>
        <div className="flex gap-2">
          <Input
            {...approvalForm.register("requestId")}
            placeholder="Paste request ID"
            className={cn(
              "h-11 rounded-xl border-black/5 bg-gray-95 text-black placeholder:text-gray-400 dark:border-white/10 dark:bg-secondary-60 dark:text-white",
              approvalForm.formState.errors.requestId && "border-red-500",
            )}
          />
          <Button
            type="submit"
            disabled={approvalForm.formState.isSubmitting}
            variant="flow"
            className="h-11 shrink-0 px-4"
          >
            <span className="relative z-10">
              {approvalForm.formState.isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Approve"
              )}
            </span>
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
          </Button>
        </div>
        {approvalForm.formState.errors.requestId && (
          <p className="text-xs text-red-500">
            {approvalForm.formState.errors.requestId.message}
          </p>
        )}
      </form>
    </div>
  );
};

interface RecoveryFormProps<
  T extends QuickRecoveryFormValues | SocialRecoveryFormValues,
> {
  title: string;
  description: string;
  form: UseFormReturn<T>;
  onSubmit: (values: T) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  includeThreshold?: boolean;
}

const RecoveryForm = <
  T extends QuickRecoveryFormValues | SocialRecoveryFormValues,
>({
  title,
  description,
  form,
  onSubmit,
  onCancel,
  submitLabel,
  includeThreshold,
}: RecoveryFormProps<T>) => (
  <form
    onSubmit={form.handleSubmit(onSubmit)}
    className="mb-6 rounded-2xl border border-primary-20/40 bg-primary-20/5 p-4 space-y-3"
  >
    <div>
      <p className="text-sm font-bold text-black dark:text-white">{title}</p>
      <p className="mt-1 text-xs text-gray-20 dark:text-secondary-90">
        {description}
      </p>
    </div>
    <Input
      {...form.register("newOwnerAddress" as Path<T>)}
      placeholder="New owner address"
      className="h-11 rounded-xl border-black/5 bg-white text-black placeholder:text-gray-400 dark:border-white/10 dark:bg-secondary-60 dark:text-white"
    />
    <Input
      {...form.register("chain" as Path<T>)}
      placeholder="Network, e.g. bnb"
      className="h-11 rounded-xl border-black/5 bg-white text-black placeholder:text-gray-400 dark:border-white/10 dark:bg-secondary-60 dark:text-white"
    />
    {includeThreshold && (
      <Input
        {...form.register("threshold" as Path<T>, { valueAsNumber: true })}
        type="number"
        min="1"
        placeholder="Required guardian approvals"
        className="h-11 rounded-xl border-black/5 bg-white text-black placeholder:text-gray-400 dark:border-white/10 dark:bg-secondary-60 dark:text-white"
      />
    )}
    {Object.keys(form.formState.errors).length > 0 && (
      <p className="text-xs text-red-500">
        {Object.values(form.formState.errors)[0]?.message as string}
      </p>
    )}
    <div className="flex gap-2">
      <Button
        type="button"
        variant="flowSecondary"
        onClick={onCancel}
        className="h-10 flex-1"
      >
        Cancel
      </Button>
      <Button
        type="submit"
        disabled={form.formState.isSubmitting}
        variant="flow"
        className="h-10 flex-1"
      >
        <span className="relative z-10">
          {form.formState.isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            submitLabel
          )}
        </span>
        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
      </Button>
    </div>
  </form>
);

interface RequestListProps {
  title: string;
  requests: RecoveryRequest[];
  emptyMessage: string;
  actionLabel: string;
  actionBusyId?: string | null;
  onAction: (requestId: string) => Promise<void>;
}

const RequestList: FC<RequestListProps> = ({
  title,
  requests,
  emptyMessage,
  actionLabel,
  actionBusyId,
  onAction,
}) => (
  <section className="mt-6">
    <p className="mb-3 px-1 text-sm font-semibold text-black dark:text-white">
      {title}
    </p>
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-secondary-60">
      {requests.length === 0 ? (
        <p className="px-4 py-5 text-sm text-gray-20 dark:text-secondary-90">
          {emptyMessage}
        </p>
      ) : (
        requests.map((request) => {
          const approvals =
            request.approvalsCount ?? request.approvals?.length ?? 0;
          const canExecute =
            actionLabel !== "Execute" || request.status !== "EXECUTED";
          const busy = actionBusyId === request.id;

          return (
            <div
              key={request.id}
              className="flex items-center gap-3 border-b border-black/5 px-4 py-3 last:border-b-0 dark:border-white/10"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-20" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-black dark:text-white">
                  {request.newOwnerAddress}
                </p>
                <p className="mt-0.5 text-xs text-gray-20 dark:text-secondary-90">
                  {approvals}/{request.threshold} approvals · {request.status}
                </p>
              </div>
              {canExecute && (
                <Button
                  variant="flow"
                  disabled={busy}
                  onClick={() => onAction(request.id)}
                  className="h-8 shrink-0 gap-1 px-3 text-xs"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    actionLabel
                  )}
                  {!busy && <ChevronRight className="h-3.5 w-3.5" />}
                </Button>
              )}
            </div>
          );
        })
      )}
    </div>
  </section>
);
