"use client";

import { FC, useState } from "react";
import { ArrowLeft, Landmark, Plus, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { BankDetail } from "@/types/db";
import { bankService } from "@/services/api/bank";
import BankList from "./BankList";
import BankForm, { BankFormValues } from "./BankForm";
import SelectBankModal, {
  type SelectableBank,
} from "@/components/modals/SelectBankModal";

interface BankAccountModalProps {
  banks: BankDetail[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
}

const BankAccountModal: FC<BankAccountModalProps> = ({
  banks,
  isLoading,
  onRefresh,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"list" | "add" | "edit">("list");
  const [selectedBank, setSelectedBank] = useState<BankDetail | null>(null);
  const [selectedProviderBank, setSelectedProviderBank] =
    useState<SelectableBank | null>(null);
  const [isSelectBankOpen, setIsSelectBankOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFormSubmit = async (values: BankFormValues) => {
    setIsSubmitting(true);
    try {
      const payload = {
        bankName: values.bankName,
        accountName: values.accountHolderName,
        accountNumber: values.accountNumber,
        bankCode: values.bankCode,
        provider: values.provider,
        country: values.country,
      };

      const res =
        view === "edit" && selectedBank?.id
          ? await bankService.updateBank(selectedBank.id, payload)
          : await bankService.addBank(payload as BankDetail);

      if (res.success) {
        toast.success(
          view === "edit"
            ? "Bank account updated successfully"
            : "Bank account added successfully",
        );

        await onRefresh();
        setView("list");
        setSelectedBank(null);
        setSelectedProviderBank(null);
      }
    } catch (err) {
      toast.error("Operation failed");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await bankService.deleteBank(id);
      if (res.success) {
        await onRefresh();
      }
    } catch (err) {
      throw err;
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(val) => {
        setIsOpen(val);
        if (!val) {
          setView("list");
          setSelectedBank(null);
          setSelectedProviderBank(null);
          setIsSelectBankOpen(false);
        }
      }}
    >
      <DialogTrigger asChild className="cursor-pointer">
        <button className="w-full bg-white dark:bg-secondary-50 border border-slate-100 dark:border-white/10 rounded-[24px] p-5 flex items-center justify-between group hover:bg-gray-50 dark:hover:bg-secondary-60/50 transition-colors cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-100 dark:bg-[#1a1f2e] rounded-xl text-primary-70">
              <Landmark className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h4 className="font-semibold text-slate-900 dark:text-white">
                Bank Accounts
              </h4>
              <p className="text-xs text-slate-500 dark:text-gray-400">
                {isLoading
                  ? "Loading..."
                  : banks.length > 0
                    ? `${banks.length} linked`
                    : "No accounts linked"}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 dark:bg-none dark:bg-black2 border-none p-0 overflow-hidden rounded-[32px] outline-none [&>button]:hidden">
        <div className="relative h-[85vh] sm:h-[700px] flex flex-col">
          <div className="flex items-center justify-between px-6 py-5">
            <button
              onClick={() =>
                view === "list" ? setIsOpen(false) : setView("list")
              }
              className="p-2 bg-white dark:bg-secondary-60/50 rounded-full border border-slate-200 dark:border-none cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-white" />
            </button>
            <DialogTitle className="text-lg font-semibold">
              {view === "list"
                ? "Bank Accounts"
                : view === "edit"
                  ? "Edit Bank Account"
                  : "Add Bank Account"}
            </DialogTitle>
            {view === "list" && (
              <button
                onClick={() => {
                  setSelectedBank(null);
                  setSelectedProviderBank(null);
                  setView("add");
                }}
                className="p-2 bg-white dark:bg-secondary-60/50 rounded-full text-primary-70 cursor-pointer"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-10">
            {view === "list" ? (
              <BankList
                key={banks.length}
                banks={banks}
                isLoading={isLoading}
                onAddNew={() => {
                  setSelectedBank(null);
                  setSelectedProviderBank(null);
                  setView("add");
                }}
                onEdit={(b) => {
                  setSelectedBank(b);
                  setSelectedProviderBank(null);
                  setView("edit");
                }}
                onDelete={handleDelete}
              />
            ) : (
              <BankForm
                initialData={selectedBank}
                selectedProviderBank={selectedProviderBank}
                onOpenBankModal={() => setIsSelectBankOpen(true)}
                onSubmit={handleFormSubmit}
                isSubmitting={isSubmitting}
              />
            )}
          </div>
        </div>
      </DialogContent>
      <SelectBankModal
        isOpen={isSelectBankOpen}
        onClose={() => setIsSelectBankOpen(false)}
        currency="NGN"
        providerName="centiiv"
        selectedBankCode={selectedProviderBank?.value || selectedBank?.bankCode}
        onSelectBank={(bank) => {
          setSelectedProviderBank(bank);
          setIsSelectBankOpen(false);
        }}
      />
    </Dialog>
  );
};

export default BankAccountModal;
