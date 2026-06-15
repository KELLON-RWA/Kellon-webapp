"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarRange, X } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

export type ActivityFilter =
  | "all"
  | "sent"
  | "received"
  | "withdraw"
  | "deposit"
  | "invoices"
  | "gifts"
  | "cards"
  | "earn";

export const ACTIVITY_FILTERS: ActivityFilter[] = [
  "all",
  "sent",
  "received",
  "withdraw",
  "deposit",
  "invoices",
  "gifts",
  "cards",
  "earn",
];

interface TransactionFilterModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  activityFilter: ActivityFilter;
  startDate: string;
  endDate: string;
  onActivityFilterChange: (filter: ActivityFilter) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onReset: () => void;
  onApply: () => void;
}

export default function TransactionFilterModal({
  isOpen,
  onClose,
  activityFilter,
  startDate,
  endDate,
  onActivityFilterChange,
  onStartDateChange,
  onEndDateChange,
  onReset,
  onApply,
}: TransactionFilterModalProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const content = (
    <div className="px-4 pb-8 md:px-0 md:pb-0">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-black dark:text-white">
            Filter Transactions
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Narrow activity by date and type.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onClose(false)}
          className="rounded-full border border-black/5 bg-white p-2 transition-opacity hover:opacity-80 dark:border-white/10 dark:bg-secondary-60/50 cursor-pointer"
          aria-label="Close filters"
        >
          <X className="h-4 w-4 text-gray-600 dark:text-white" />
        </button>
      </div>

      <div className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <DateField
            label="Start Date"
            value={startDate}
            onChange={onStartDateChange}
          />
          <DateField
            label="End Date"
            value={endDate}
            onChange={onEndDateChange}
          />
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-tight text-gray-500 dark:text-gray-400">
            Activity Type
          </label>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => onActivityFilterChange(filter)}
                className={cn(
                  "cursor-pointer",
                  "rounded-full border px-3 py-2 text-[11px] font-semibold capitalize transition",
                  activityFilter === filter
                    ? "border-primary-60 bg-primary-70/10 text-primary-60 dark:bg-primary-70/15 dark:text-primary-80"
                    : "border-black/5 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-60 dark:text-gray-400 dark:hover:bg-secondary-60/60",
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onReset}
          className={cn(
            "group relative flex-1 overflow-hidden rounded-xl border border-black/5 bg-white py-3 transition-all hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-50 dark:hover:bg-secondary-60/50 active:scale-95 cursor-pointer font-bold",
          )}
        >
          <span className="relative z-10 flex items-center justify-center gap-2 text-sm">
            Reset
          </span>
        </button>
        <Button
          variant="flow"
          size="flow"
          type="button"
          onClick={onApply}
          className="group relative flex-1 overflow-hidden  py-3 font-bold text-white shadow-lg transition-all hover:shadow-xl active:scale-95 cursor-pointer"
        >
          <span className="relative z-10 flex items-center justify-center gap-2 text-sm">
            Apply
          </span>
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
        </Button>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="border-none bg-gray-70 outline-none sm:max-w-[460px] rounded-[32px] dark:bg-black2 [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Filter Transactions</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="rounded-t-[32px] border-none bg-gray-70 outline-none dark:bg-black2 [&>button]:hidden">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Filter Transactions</DrawerTitle>
        </DrawerHeader>
        {content}
      </DrawerContent>
    </Drawer>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedDate = parseDateValue(value);

  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-tight text-gray-500 dark:text-gray-400">
        {label}
      </label>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 rounded-2xl border border-black/5 bg-white px-3 py-3 text-left text-xs transition hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-60 dark:hover:bg-secondary-60/60",
              selectedDate
                ? "text-black dark:text-white"
                : "text-gray-500 dark:text-gray-400",
            )}
          >
            <CalendarRange className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="flex-1">
              {selectedDate ? format(selectedDate, "MMM d, yyyy") : label}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="w-full"
        >
          <Calendar
            mode="single"
            captionLayout="dropdown"
            hideNavigation
            startMonth={new Date(2020, 0)}
            endMonth={new Date(new Date().getFullYear() + 5, 11)}
            selected={selectedDate}
            defaultMonth={selectedDate}
            onSelect={(date) => {
              onChange(date ? format(date, "yyyy-MM-dd") : "");
              setIsOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function parseDateValue(value: string): Date | undefined {
  if (!value) return undefined;

  const date = new Date(`${value}T00:00:00.000`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
