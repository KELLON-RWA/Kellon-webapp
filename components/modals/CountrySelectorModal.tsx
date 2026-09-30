"use client";

import * as React from "react";
import { useState, useMemo } from "react";
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
import { Search, X, CheckCircle, Globe, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_SUPPORTED_COUNTRIES } from "@/lib/supported-countries";
import { Input } from "@/components/ui/input";

interface CountrySelectorModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (countryCode: string) => void;
  selectedCountry?: string;
  countries?: string[]; // Optional: restrict to specific country codes
}

export const CountrySelectorModal: React.FC<CountrySelectorModalProps> = ({
  isVisible,
  onClose,
  onSelect,
  selectedCountry,
  countries,
}) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [searchQuery, setSearchQuery] = useState("");

  // Memoized list filtering logic
  const filteredCountries = useMemo(() => {
    const baseList = countries
      ? ALL_SUPPORTED_COUNTRIES.filter((c) => countries.includes(c.code))
      : ALL_SUPPORTED_COUNTRIES;

    if (!searchQuery) return baseList;
    const q = searchQuery.toLowerCase();
    return baseList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [searchQuery, countries]);

  // Flag emoji helper
  const getFlag = (code: string) =>
    code
      .toUpperCase()
      .replace(/./g, (char) =>
        String.fromCodePoint(char.charCodeAt(0) + 127397),
      );

  const content = (
    <div className="flex h-[600px] flex-col px-4 pb-8 md:h-[500px] md:px-0 md:pb-0">
      {/* Header with Back Button */}
      <div className="mb-6 flex justify-start">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-black/5 bg-white p-2 outline-none transition-opacity hover:opacity-80 dark:border-none dark:bg-secondary-60/50 cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-white" />
        </button>
      </div>

      {/* Centered Text Header */}
      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold text-black dark:text-white">
          Select Country
        </h2>
        <p className="text-sm text-gray-500 dark:text-secondary-90">
          Choose your residence
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
        <Input
          type="text"
          placeholder="Search country..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-12 rounded-2xl border-black/5 bg-gray-95 pl-11 pr-10 text-sm text-black placeholder:text-gray-400 focus-visible:ring-primary-70/20 dark:border-white/10 dark:bg-secondary-60 dark:text-white dark:placeholder:text-gray-500"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 transition hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer"
            aria-label="Clear country search"
          >
            <X className="h-4 w-4 text-gray-500 hover:text-black dark:hover:text-white" />
          </button>
        )}
      </div>

      {/* Country List */}
      <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto pr-1">
        {filteredCountries.length > 0 ? (
          filteredCountries.map((item) => {
            // Strict comparison for selection
            const isSelected =
              selectedCountry?.toUpperCase() === item.code.toUpperCase();
            return (
              <button
                type="button"
                key={item.code}
                onClick={() => {
                  onSelect(item.code);
                  onClose();
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between rounded-[24px] border p-5 outline-none transition-all",
                  isSelected
                    ? "border-primary-70 bg-primary-70/10"
                    : "border-black/5 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-60 dark:hover:bg-secondary-60/50",
                )}
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{getFlag(item.code)}</span>
                  <div className="text-left">
                    <p
                      className={cn(
                        "font-bold text-sm",
                        isSelected
                          ? "text-primary-70"
                          : "text-black dark:text-white",
                      )}
                    >
                      {item.name}
                    </p>
                    <p className="text-[10px] uppercase tracking-tight text-gray-500">
                      {item.code}
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <CheckCircle className="h-5 w-5 fill-primary-70/10 text-primary-70" />
                )}
              </button>
            );
          })
        ) : (
          <div className="py-20 text-center">
            <Globe className="mx-auto mb-3 h-12 w-12 text-gray-300 dark:text-gray-700" />
            <p className="text-gray-500">No countries found</p>
          </div>
        )}
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={isVisible} onOpenChange={onClose}>
        <DialogContent className="rounded-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 outline-none dark:bg-none dark:bg-black2 sm:max-w-[425px] [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Select Country</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isVisible} onOpenChange={onClose}>
      <DrawerContent className="rounded-t-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 outline-none focus:outline-none dark:bg-none dark:bg-black2 [&>button]:hidden">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Select Country</DrawerTitle>
        </DrawerHeader>
        {content}
      </DrawerContent>
    </Drawer>
  );
};
