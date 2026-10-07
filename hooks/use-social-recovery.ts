import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Guardian } from "@/types/db";
import {
  getMyGuardians,
  getGuardiansOf,
  addGuardian,
  approveRecovery,
  acceptGuardianInvite,
  executeRecovery,
  executeSimpleRecover,
  getMyRecoveryRequests,
  getPendingApprovals,
  initiateRecovery,
  removeGuardian,
  type RecoveryRequest,
} from "@/services/api/social-recovery";
import {
  ApprovalFormValues,
  approvalSchema,
  GuardianFormValues,
  guardianSchema,
  QuickRecoveryFormValues,
  quickRecoverySchema,
  SocialRecoveryFormValues,
  socialRecoverySchema,
} from "@/lib/validations/social-recovery";

export const useSocialRecovery = (isOpen: boolean) => {
  const [currentView, setCurrentView] = useState<"main" | "manage-guardians">(
    "main",
  );
  const [activeTab, setActiveTab] = useState<"my-guardians" | "guardian-for">(
    "my-guardians",
  );
  const [myGuardians, setMyGuardians] = useState<Guardian[]>([]);
  const [guardianFor, setGuardianFor] = useState<Guardian[]>([]);
  const [recoveryRequests, setRecoveryRequests] = useState<RecoveryRequest[]>(
    [],
  );
  const [pendingApprovals, setPendingApprovals] = useState<RecoveryRequest[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);

  const guardianForm = useForm<GuardianFormValues>({
    resolver: zodResolver(guardianSchema),
    defaultValues: { guardianId: "" },
  });

  const approvalForm = useForm<ApprovalFormValues>({
    resolver: zodResolver(approvalSchema),
    defaultValues: { requestId: "" },
  });

  const quickRecoveryForm = useForm<QuickRecoveryFormValues>({
    resolver: zodResolver(quickRecoverySchema),
    defaultValues: { newOwnerAddress: "", chain: "" },
  });

  const socialRecoveryForm = useForm<SocialRecoveryFormValues>({
    resolver: zodResolver(socialRecoverySchema),
    defaultValues: { newOwnerAddress: "", chain: "", threshold: 1 },
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [myResult, forResult, requestsResult, approvalsResult] =
        await Promise.allSettled([
          getMyGuardians(),
          getGuardiansOf(),
          getMyRecoveryRequests(),
          getPendingApprovals(),
        ]);

      if (myResult.status === "fulfilled" && myResult.value.success) {
        setMyGuardians(myResult.value.data || []);
      }
      if (forResult.status === "fulfilled" && forResult.value.success) {
        setGuardianFor(forResult.value.data || []);
      }
      if (
        requestsResult.status === "fulfilled" &&
        requestsResult.value.success
      ) {
        setRecoveryRequests(requestsResult.value.data || []);
      }
      if (
        approvalsResult.status === "fulfilled" &&
        approvalsResult.value.success
      ) {
        setPendingApprovals(approvalsResult.value.data || []);
      }

      if (
        [myResult, forResult, requestsResult, approvalsResult].every(
          (result) => result.status === "rejected",
        )
      ) {
        throw new Error("Unable to load recovery data");
      }
    } catch {
      toast.error("Failed to sync guardian data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-fetch data when modal opens or view changes to management
  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData, currentView]);

  const handleAddGuardian = async (values: GuardianFormValues) => {
    const exists = myGuardians.some(
      (g) => g.guardian?.tag?.toLowerCase() === values.guardianId.toLowerCase(),
    );

    if (exists) {
      toast.error("User is already a guardian or pending.");
      return;
    }
    try {
      const res = await addGuardian(values.guardianId);
      if (res.success) {
        toast.success("Guardian invitation sent");
        guardianForm.reset();
        await fetchData();
      } else {
        toast.error(res.message || "Failed to add guardian");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add guardian",
      );
    }
  };

  const handleApproveRequest = async (values: ApprovalFormValues) => {
    setIsLoading(true);
    try {
      const res = await approveRecovery(values.requestId);
      if (res.success) {
        toast.success("Recovery request approved");
        approvalForm.reset();
        await fetchData();
      } else {
        toast.error(res.message || "Approval failed. Check the ID.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to approve request",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptInvite = async (userId: string) => {
    try {
      const res = await acceptGuardianInvite(userId);
      if (res.success) {
        toast.success("Guardian invitation accepted");
        await fetchData();
      } else {
        toast.error(res.message || "Failed to accept invitation");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to accept invitation",
      );
    }
  };

  const handleRemoveGuardian = async (guardianId: string) => {
    try {
      const res = await removeGuardian(guardianId);
      if (!res.success) {
        throw new Error(res.message || "Failed to remove guardian");
      }
      toast.success("Guardian removed");
      await fetchData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove guardian",
      );
    }
  };

  const handleQuickRecovery = async (values: QuickRecoveryFormValues) => {
    try {
      const res = await executeSimpleRecover(values);
      if (!res.success) {
        throw new Error(res.message || "Quick recovery failed");
      }
      toast.success("Quick recovery submitted");
      quickRecoveryForm.reset();
      await fetchData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Quick recovery failed",
      );
    }
  };

  const handleInitiateRecovery = async (values: SocialRecoveryFormValues) => {
    try {
      const res = await initiateRecovery(values);
      if (!res.success) {
        throw new Error(res.message || "Recovery request failed");
      }
      toast.success("Recovery request sent to your guardians");
      socialRecoveryForm.reset();
      await fetchData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Recovery request failed",
      );
    }
  };

  const handleExecuteRecovery = async (requestId: string) => {
    try {
      const res = await executeRecovery(requestId);
      if (!res.success) {
        throw new Error(res.message || "Recovery execution failed");
      }
      toast.success("Recovery execution submitted");
      await fetchData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Recovery execution failed",
      );
    }
  };

  return {
    currentView,
    setCurrentView,
    activeTab,
    setActiveTab,
    myGuardians,
    guardianFor,
    recoveryRequests,
    pendingApprovals,
    isLoading,
    guardianForm,
    approvalForm,
    quickRecoveryForm,
    socialRecoveryForm,
    fetchData,
    handleAddGuardian,
    handleApproveRequest, // Added this
    handleAcceptInvite, // Added this
    handleRemoveGuardian,
    handleQuickRecovery,
    handleInitiateRecovery,
    handleExecuteRecovery,
  };
};
