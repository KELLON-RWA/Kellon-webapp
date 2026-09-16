"use client";

import { useRef } from "react";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "delete"];

interface KeypadProps {
  onPress: (val: string) => void;
  className?: string;
  buttonClassName?: string;
}

export default function Keypad({
  onPress,
  className,
  buttonClassName,
}: KeypadProps) {
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const cancelClearTimer = () => {
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
  };

  const startClearTimer = () => {
    didLongPress.current = false;
    clearTimer.current = setTimeout(() => {
      didLongPress.current = true;
      onPress("clear");
    }, 600);
  };

  return (
    <div className={cn("grid w-full grid-cols-3 gap-2", className)}>
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onPointerDown={key === "delete" ? startClearTimer : undefined}
          onPointerUp={key === "delete" ? cancelClearTimer : undefined}
          onPointerCancel={key === "delete" ? cancelClearTimer : undefined}
          onPointerLeave={key === "delete" ? cancelClearTimer : undefined}
          onClick={() => {
            if (key === "delete" && didLongPress.current) {
              didLongPress.current = false;
              return;
            }
            onPress(key);
          }}
          className={cn(
            "cursor-pointer",
            "flex h-14 select-none items-center justify-center rounded-2xl border border-black/5 bg-white text-xl font-bold transition-colors active:scale-95 hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-50 dark:hover:bg-secondary-60/50",
            buttonClassName,
          )}
        >
          {key === "delete" ? (
            <Delete className="h-6 w-6 text-gray-500" />
          ) : (
            key
          )}
        </button>
      ))}
    </div>
  );
}
