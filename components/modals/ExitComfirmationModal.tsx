import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ExitConfirmationProps {
  isOpen: boolean;
  onStay: () => void;
  onLeave: () => void;
  title?: string;
  description?: string;
  leaveLabel?: string;
}

export function ExitConfirmation({
  isOpen,
  onStay,
  onLeave,
  title = "Leave this flow?",
  description = "Your progress will be discarded. You can start again whenever you're ready.",
  leaveLabel = "Cancel",
}: ExitConfirmationProps) {
  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="w-[92vw] max-w-[400px] rounded-[32px] border-none bg-gray-70 outline-none dark:bg-black2">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold text-slate-900 dark:text-white">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-500 dark:text-gray-400">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 !grid grid-cols-2 gap-3 sm:!grid sm:grid-cols-2">
          <button
            type="button"
            onClick={onStay}
            className="h-11 min-w-0 cursor-pointer rounded-xl border border-black/5 bg-white px-2 text-xs font-bold text-black transition-all hover:bg-gray-50 active:scale-[0.98] dark:border-white/10 dark:bg-secondary-50 dark:text-white dark:hover:bg-secondary-60/50 sm:h-12 sm:rounded-2xl sm:px-4 sm:text-sm"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="h-11 min-w-0 cursor-pointer rounded-xl border-none bg-red-500 px-2 text-xs font-bold text-white transition-all hover:bg-red-600 active:scale-[0.98] dark:bg-red-600 dark:hover:bg-red-500 sm:h-12 sm:rounded-2xl sm:px-4 sm:text-sm"
          >
            {leaveLabel}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
