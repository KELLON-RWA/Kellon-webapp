"use client";

import { FC, useState, useMemo, useEffect, useRef } from "react";
import {
  ArrowLeft,
  X,
  ChevronDown,
  Copy,
  Check,
  ReceiptText,
} from "lucide-react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import ChainIcon from "@/components/wallet/ChainIcon";
import { ChainAccount } from "@/types/db";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import SelectNetworkModal from "@/components/modals/SelectNetworkModal";
import { Button } from "@/components/ui/button";

interface ReceiveCryptoProps {
  chainAccounts: ChainAccount[];
  onClose?: () => void;
}

const ReceiveCrypto: FC<ReceiveCryptoProps> = ({ chainAccounts, onClose }) => {
  const router = useRouter();
  // Filter out avalanche and sort networks
  const filteredChainAccounts = useMemo(() => {
    return chainAccounts
      .filter((account) => account.chain.toLowerCase() !== "avalanche")
      .sort((a, b) => a.chain.localeCompare(b.chain));
  }, [chainAccounts]);

  const [selectedChainId, setSelectedChainId] = useState<string>(
    filteredChainAccounts?.[0]?.id || "",
  );
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const goBack = () => router.back();
  const handleClose = () => (onClose ? onClose() : router.back());

  const selectedAccount = useMemo(
    () => filteredChainAccounts?.find((acc) => acc.id === selectedChainId),
    [filteredChainAccounts, selectedChainId],
  );

  // Get address based on chain type
  const address = useMemo(() => {
    if (!selectedAccount) return "";
    // For Stellar, use publicKey
    if (selectedAccount.chain.toLowerCase() === "stellar") {
      return selectedAccount.publicKey || "";
    }
    // For other chains, use smartAccountAddress
    return selectedAccount.smartAccountAddress || "";
  }, [selectedAccount]);

  const chainName = selectedAccount?.chain || "";

  // Transform chainAccounts to the format expected by SelectNetworkModal
  const networks = useMemo(() => {
    return filteredChainAccounts.map((account) => ({
      id: account.id,
      name: account.chain.charAt(0).toUpperCase() + account.chain.slice(1),
    }));
  }, [filteredChainAccounts]);

  // Generate QR code on address change
  useEffect(() => {
    if (!address || !canvasRef.current) return;
    QRCode.toCanvas(
      canvasRef.current,
      address,
      {
        width: 224,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "H",
      },
      (error) => {
        if (error) console.error("QR generation failed", error);
      },
    );
  }, [address]);

  const handleCopyAddress = async () => {
    if (!address) return;
    await copyToClipboard(address, "Address copied to clipboard");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareAddress = async () => {
    if (!address) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Receive Crypto",
          text: `My ${chainName} address:`,
          url: address,
        });
      } catch (err) {
        console.error("Share failed", err);
      }
    } else {
      await handleCopyAddress();
    }
  };

  const handleSelectNetwork = (chainId: string) => {
    setSelectedChainId(chainId);
  };

  if (filteredChainAccounts.length === 0) {
    return (
      <div className="flex flex-col container max-w-2xl mx-auto min-h-[90dvh] pb-32 md:pt-20">
        <div className="flex items-center justify-between mb-8 px-4 pt-4">
          <button
            onClick={goBack}
            className="p-2 bg-gray-100 dark:bg-secondary-60/50 rounded-full border border-slate-200 dark:border-none cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-white" />
          </button>
          <h2 className="text-lg font-bold text-black dark:text-white">
            Receive
          </h2>
          <button
            onClick={handleClose}
            className="p-2 bg-gray-100 dark:bg-secondary-60/50 rounded-full border border-slate-200 dark:border-none cursor-pointer"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-white" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No networks available
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col container max-w-2xl mx-auto min-h-[90dvh] pb-32 md:pt-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 px-4 pt-4">
        <button
          onClick={goBack}
          className="p-2 bg-gray-100 dark:bg-secondary-60/50 rounded-full border border-slate-200 dark:border-none cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-white" />
        </button>
        <h2 className="text-lg font-bold text-black dark:text-white">
          Receive
        </h2>
        <button className="p-2 bg-gray-100 dark:bg-secondary-60/50 rounded-full border border-slate-200 dark:border-none cursor-pointer">
          <ReceiptText className="w-5 h-5 text-slate-600 dark:text-white" />
        </button>
      </div>

      {/* Network Selector - Opens Modal */}
      <div className="flex justify-center mb-8">
        <button
          onClick={() => setIsNetworkModalOpen(true)}
          className="flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-1.5 transition-all hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-50 dark:hover:bg-secondary-60/50 cursor-pointer"
        >
          {chainName && <ChainIcon name={chainName} size={18} />}
          <span className="text-[10px] font-bold uppercase tracking-tight">
            {chainName || "Select Network"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
        </button>
      </div>

      {/* QR Code with centered logo */}
      <div className="flex justify-center mb-6">
        <div className="relative w-64 h-64 bg-white rounded-2xl shadow-lg p-4 flex items-center justify-center">
          {address ? (
            <canvas ref={canvasRef} width={224} height={224} />
          ) : (
            <div className="text-gray-400">No address available</div>
          )}
          {chainName && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white rounded-full p-2 shadow-md">
                <ChainIcon name={chainName} size={40} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Address Display with Copy Icon */}
      <div className="text-center mb-6 px-4">
        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1 justify-center">
          Your wallet address <ChevronDown className="w-3 h-3" />
        </p>
        <div className="flex items-center gap-2 border border-black/5 bg-white dark:border-white/10 dark:bg-secondary-50 p-3 rounded-xl">
          <p className="flex-1 text-xs font-mono break-all">
            {address || "No address found"}
          </p>
          {address && (
            <button
              onClick={handleCopyAddress}
              className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-secondary-60 rounded-lg transition-colors cursor-copy"
              aria-label="Copy address"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Disclaimers */}
      <div className="text-center text-[10px] text-gray-400 px-4 space-y-1 mb-8">
        <p>Only send {chainName} assets to this address.</p>
        <p>Sending other cryptocurrencies may result in permanent loss.</p>
        <p>Always verify the address before transferring.</p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 px-4">
        <Button
          type="button"
          variant="flowSecondary"
          size="action"
          onClick={handleCopyAddress}
          className="flex-1 cursor-copy"
        >
          <span className="relative z-10 flex items-center justify-center gap-2 text-sm md:text-base">
            {copied ? "Copied!" : "Copy Address"}
          </span>
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-gray-900/5 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
        </Button>

        <Button
          type="button"
          variant="flow"
          size="action"
          onClick={shareAddress}
          className="flex-1"
        >
          <span className="relative z-10 flex items-center justify-center gap-2 text-sm md:text-base">
            Share Address
          </span>
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
        </Button>
      </div>

      {/* Network Selection Modal */}
      <SelectNetworkModal
        isOpen={isNetworkModalOpen}
        onClose={setIsNetworkModalOpen}
        chains={networks}
        selectedChainId={selectedChainId}
        onSelectChain={handleSelectNetwork}
      />
    </div>
  );
};

export default ReceiveCrypto;
