"use client";

import { FC, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface GuardianListItemProps {
  id: string;
  label: string; // e.g., "Progress Ojemeh"
  status: string; // e.g., "ACTIVE" or "PENDING"
  showAcceptButton?: boolean;
  onAccept?: () => Promise<void>;
  showRemoveButton?: boolean;
  onRemove?: () => Promise<void>;
}

export const GuardianListItem: FC<GuardianListItemProps> = ({
  label,
  status,
  showAcceptButton,
  onAccept,
  showRemoveButton,
  onRemove,
}) => {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [activeDateLabel, setActiveDateLabel] = useState("");

  useEffect(() => {
    setActiveDateLabel(new Date().toISOString().split("T")[0]);
  }, []);

  // Generate initials for the avatar (e.g., "Progress Ojemeh" -> "PO")
  const initials = label
    ? label
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const handleAcceptClick = async () => {
    if (!onAccept) return;
    setIsAccepting(true);
    try {
      await onAccept();
    } catch {
      toast.error("Failed to accept invitation");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleRemoveClick = async () => {
    if (!onRemove) return;
    setIsRemoving(true);
    try {
      await onRemove();
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-secondary-60 border border-black/5 dark:border-white/10 rounded-[24px] transition-all">
      <div className="flex items-center gap-4">
        {/* Avatar Circle */}
        <Avatar className="w-12 h-12 bg-primary-70 border-none">
          <AvatarFallback className="bg-primary-70 text-white font-bold text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-col text-left">
          <span className="text-sm font-bold text-black dark:text-white leading-tight">
            {label}
          </span>
          <span
            className={cn(
              "text-[10px] font-bold mt-1",
              status === "ACTIVE" || status === "ACCEPTED"
                ? "text-green-500"
                : "text-orange-500",
            )}
          >
            {status}{" "}
            {status === "ACTIVE" && activeDateLabel
              ? `(${activeDateLabel})`
              : null}
          </span>
        </div>
      </div>

      {showAcceptButton && status === "PENDING" && (
        <Button
          onClick={handleAcceptClick}
          disabled={isAccepting}
          variant="flow"
          className="h-9 px-5 text-xs"
        >
          {isAccepting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Accept"
          )}
        </Button>
      )}
      {showRemoveButton && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remove ${label || "guardian"}`}
          onClick={handleRemoveClick}
          disabled={isRemoving}
          className="h-9 w-9 rounded-xl text-gray-20 hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed"
        >
          {isRemoving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </Button>
      )}
    </div>
  );
};
