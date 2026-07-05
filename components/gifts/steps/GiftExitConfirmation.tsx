"use client"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface GiftExitConfirmationProps {
  open: boolean
  onStay: () => void
  onLeave: () => void
}

export default function GiftExitConfirmation({
  open,
  onStay,
  onLeave,
}: GiftExitConfirmationProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="w-[92vw] max-w-[340px] rounded-[32px] border-none bg-gray-70 outline-none dark:bg-black2">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold text-black dark:text-white">
            Leave gift flow?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
            Your gift details have not been sent yet. You can stay here to keep
            editing.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row justify-end gap-3 sm:justify-end">
          <button
            type="button"
            onClick={onStay}
            className="cursor-pointer rounded-full px-3 py-2 text-sm font-bold text-gray-500 transition-colors hover:bg-gray-50 hover:text-black dark:text-gray-400 dark:hover:bg-secondary-60/50 dark:hover:text-white"
          >
            Stay
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="cursor-pointer rounded-full px-3 py-2 text-sm font-bold text-primary-70 transition-opacity hover:opacity-80"
          >
            Leave
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
