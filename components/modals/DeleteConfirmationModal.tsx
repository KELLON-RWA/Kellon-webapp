"use client";

import { FC, ReactNode, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeleteConfirmationModalProps {
  trigger?: ReactNode;
  title?: string;
  description?: string;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
  itemName?: string;
}

const DeleteConfirmationModal: FC<DeleteConfirmationModalProps> = ({
  trigger,
  title,
  description,
  onConfirm,
  isDeleting,
  itemName,
}) => {
  // Add state to control modal visibility
  const [open, setOpen] = useState(false);

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent auto-closing so we can wait for the API
    await onConfirm();
    setOpen(false); // Manually close the modal on success
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger || (
          <button className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors cursor-pointer">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </AlertDialogTrigger>

      <AlertDialogContent className="w-[92vw] max-w-[400px] rounded-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 outline-none dark:bg-none dark:bg-black2">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-500 dark:text-gray-400">
            {description || (
              <>
                Are you sure you want to delete{" "}
                {itemName ? <strong>{itemName}</strong> : "this item"}? This
                action cannot be undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-6 gap-3">
          <AlertDialogCancel
            className="flex-1 h-12 rounded-2xl border-black/5 bg-white transition-all hover:bg-gray-50 disabled:cursor-not-allowed dark:border-white/10 dark:bg-secondary-50 dark:text-white dark:hover:bg-secondary-60/50 cursor-pointer"
            disabled={isDeleting}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex-1 h-12 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold border-none transition-all disabled:cursor-not-allowed cursor-pointer"
          >
            {isDeleting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteConfirmationModal;
