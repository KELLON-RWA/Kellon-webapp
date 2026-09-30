"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Landmark, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  providerService,
  type CentiivBank,
  type PaycrestInstitution,
} from "@/services/api/payment-providers";
import { cn } from "@/lib/utils";

export type SelectableBank = {
  label: string;
  value: string;
  image?: string | null;
};

interface SelectBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: string;
  providerName: string | null;
  selectedBankCode?: string | null;
  onSelectBank: (bank: SelectableBank) => void;
}

function getStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getInstitutionLabel(bank: PaycrestInstitution | CentiivBank) {
  if ("name" in bank && bank.name) return bank.name;
  if ("institution" in bank && bank.institution) return bank.institution;
  if ("code" in bank && bank.code) return bank.code;
  return "Bank";
}

function getInstitutionCode(bank: PaycrestInstitution | CentiivBank) {
  if ("code" in bank && bank.code) return bank.code;
  if ("id" in bank && bank.id) return bank.id;
  if ("institution" in bank && bank.institution) return bank.institution;
  return "";
}

function getInstitutionImage(bank: PaycrestInstitution | CentiivBank) {
  const bankRecord = bank as Record<string, unknown>;
  const metadata =
    typeof bankRecord.metadata === "object" && bankRecord.metadata
      ? (bankRecord.metadata as Record<string, unknown>)
      : {};

  return (
    getStringValue(bankRecord.logo) ||
    getStringValue(bankRecord.logoUrl) ||
    getStringValue(bankRecord.image) ||
    getStringValue(bankRecord.imageUrl) ||
    getStringValue(bankRecord.icon) ||
    getStringValue(bankRecord.avatar) ||
    getStringValue(metadata.logo) ||
    getStringValue(metadata.logoUrl) ||
    getStringValue(metadata.image) ||
    getStringValue(metadata.imageUrl) ||
    null
  );
}

export default function SelectBankModal({
  isOpen,
  onClose,
  currency,
  providerName,
  selectedBankCode,
  onSelectBank,
}: SelectBankModalProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [bankOptions, setBankOptions] = useState<SelectableBank[]>([]);
  const [bankSearch, setBankSearch] = useState("");
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);
  const providerKey = providerName?.toLowerCase() || "";
  const isPaycrest = providerKey === "paycrest";

  useEffect(() => {
    if (!isOpen) {
      setBankSearch("");
      return;
    }

    let cancelled = false;

    const loadBanks = async () => {
      setIsLoadingBanks(true);
      try {
        if (isPaycrest) {
          const response =
            await providerService.getPaycrestInstitutions(currency);
          if (cancelled) return;

          setBankOptions(
            (response.data || [])
              .map((bank) => ({
                label: getInstitutionLabel(bank),
                value: getInstitutionCode(bank),
                image: getInstitutionImage(bank),
              }))
              .filter((bank) => bank.value),
          );
        } else {
          const response = await providerService.getBankList();
          if (cancelled) return;

          setBankOptions(
            (response.data || []).map((bank) => ({
              label: bank.name,
              value: bank.code,
              image: null,
            })),
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load banks:", error);
          toast.error("Unable to load bank list");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingBanks(false);
        }
      }
    };

    loadBanks();

    return () => {
      cancelled = true;
    };
  }, [currency, isOpen, isPaycrest]);

  const filteredBanks = useMemo(() => {
    const query = bankSearch.trim().toLowerCase();
    if (!query) return bankOptions;

    return bankOptions.filter((bank) => {
      return (
        bank.label.toLowerCase().includes(query) ||
        bank.value.toLowerCase().includes(query)
      );
    });
  }, [bankOptions, bankSearch]);

  const content = (
    <div className="relative flex h-[85vh] flex-col overflow-hidden sm:h-[700px]">
      <div className="flex items-center justify-between border-b border-gray-90 px-6 py-5 dark:border-white/5">
        <div className="h-9 w-9" />
        <DialogTitle className="text-lg font-semibold text-cryptoNight dark:text-white">
          Select Bank
        </DialogTitle>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-black/5 bg-white p-2 text-gray-20 outline-none transition-opacity hover:opacity-80 dark:border-none dark:bg-secondary-60/50 dark:text-white cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden px-6 pb-8 pt-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-30 dark:text-gray-40" />
          <Input
            value={bankSearch}
            onChange={(event) => setBankSearch(event.target.value)}
            placeholder="Search banks..."
            className="h-12 rounded-2xl border-black/5 bg-gray-95 pl-11 text-sm text-black placeholder:text-gray-400 focus-visible:ring-primary-70/20 dark:border-white/10 dark:bg-secondary-60 dark:text-white dark:placeholder:text-gray-40"
          />
        </div>

        <div className="mt-5 h-[calc(100%-68px)] overflow-y-auto rounded-2xl border border-gray-90 bg-white dark:border-white/10 dark:bg-secondary-50">
          {isLoadingBanks ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-gray-30 dark:text-gray-40">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading banks...
            </div>
          ) : filteredBanks.length ? (
            filteredBanks.map((bank, index) => {
              const isSelected = bank.value === selectedBankCode;

              return (
                <button
                  key={`${bank.value}-${index}`}
                  type="button"
                  onClick={() => {
                    onSelectBank(bank);
                    onClose();
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 border-b border-gray-90 px-4 py-4 text-left outline-none transition-all last:border-b-0 dark:border-white/10",
                    isSelected
                      ? "bg-primary-95/80 dark:bg-primary-70/10"
                      : "hover:bg-gray-50 dark:hover:bg-secondary-60/50",
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-95 text-primary-60 dark:bg-primary-70/10 dark:text-primary-80">
                    {bank.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={bank.image}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Landmark className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-cryptoNight dark:text-white">
                      {bank.label}
                    </span>
                  </span>
                  {isSelected ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-primary-60" />
                  ) : null}
                </button>
              );
            })
          ) : (
            <div className="px-4 py-10 text-center text-sm text-gray-30 dark:text-gray-40">
              No banks found.
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          showCloseButton={false}
          className="overflow-hidden rounded-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 p-0 shadow-xl outline-none dark:bg-none dark:bg-black2 sm:max-w-lg [&>button]:hidden"
        >
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[92vh] rounded-t-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 outline-none dark:bg-none dark:bg-black2 [&>button]:hidden [&>div:first-child]:bg-gray-80 dark:[&>div:first-child]:bg-white/20">
        <DrawerTitle className="sr-only">Select Bank</DrawerTitle>
        {content}
      </DrawerContent>
    </Drawer>
  );
}
