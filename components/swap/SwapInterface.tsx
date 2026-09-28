"use client";

import { chainStatus } from "@/lib/chain-status";

import {
  useState,
  useEffect,
  useCallback,
  FC,
  HtmlHTMLAttributes,
} from "react";
import {
  getTokens,
  getRoutes,
  RoutesRequest,
  Route,
  Token,
  TokensResponse,
  RoutesResponse,
} from "@lifi/sdk";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { parseUnits } from "viem";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileClock, RotateCw, Settings } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  sendAmountFormSchema,
  SendAmountFormSchemaType,
} from "@/lib/validations/form";
import { useSupportedChains } from "@/hooks/use-supported-chains";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import ChainSelect from "./ChainSelect";
import SwapBox from "./SwapBox";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { useRouter, useSearchParams } from "next/navigation";
import SendAmount from "./SendAmount";
import { Icons } from "@/components/Icons";
import { useDebounce } from "@/hooks/use-debounce";
import SelectedRoute from "./SelectedRoute";
import NoRoutesAvailable from "./NoRoutesAvailable";
import { RouteOptionSkeleton } from "@/components/Skeletons";
import RoutesCard from "./RoutesCard";
import RouteOptionsMobile from "./RouteOptionMobile";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useWallets } from "@privy-io/react-auth";
import {
  setStickyVerificationCode,
  useSmartAccount,
} from "@/hooks/useSmartAccount";
import { useUser } from "@/hooks/use-user";
import { expectedSafeFor, resolveEvmSigner } from "@/lib/evm-signer";
import { bridgeService, type BridgeProvider } from "@/services/api/bridge";
import { bridgeOutbox } from "@/services/api/bridge-outbox";
import { yieldService } from "@/services/api/yield";
import { beginOperation, endOperation } from "@/services/api";
import {
  findTransferVerificationRequiredError,
  getAvailableVerificationMethods,
  getOtpChannelForMethod,
  transferService,
  type VerificationMethod,
} from "@/services/api/transfers";
import { getActiveChains } from "@/lib/chains";
import TransferVerificationModal from "@/components/wallet/send/TransferVerificationModal";

const BRIDGEABLE_SYMBOLS = ["USDC", "USDT"];

function getChainKeyById(chainId: number): string | undefined {
  return Object.entries(getActiveChains()).find(
    ([, chain]) => String(chain.id) === String(chainId),
  )?.[0];
}

// import { getAPIKey } from "@/lib/APIConfig"

type SwapInterfaceProps = HtmlHTMLAttributes<HTMLDivElement>;

const SwapInterface: FC<SwapInterfaceProps> = ({ className }) => {
  const { address, isConnected } = useAccount();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isMobile = useIsMobile(1024);
  // Chains (as numbers)
  const fromChain = searchParams.get("fromChain")
    ? Number(searchParams.get("fromChain"))
    : 0; // default ETH
  const toChain = searchParams.get("toChain")
    ? Number(searchParams.get("toChain"))
    : 0; // default Polygon

  // Tokens (as addresses)
  const fromTokenAddress = searchParams.get("fromToken");
  const toTokenAddress = searchParams.get("toToken");

  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [isBridging, setIsBridging] = useState(false);
  const [verificationType, setVerificationType] =
    useState<VerificationMethod | null>(null);
  const [verificationMethods, setVerificationMethods] = useState<
    VerificationMethod[]
  >([]);
  const [verificationContext, setVerificationContext] = useState<
    "bridge" | "transfer"
  >("bridge");
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const { wallets } = useWallets();
  const { getSmartAccountClient } = useSmartAccount();
  const { data: profile } = useUser();
  const { chains } = useSupportedChains();
  const [isChainSelectOpen, setIsChainSelectOpen] = useState<boolean>(false);
  const [selectingSide, setSelectingSide] = useState<"from" | "to" | null>(
    null,
  );
  const [isRefetched, setIsRefetched] = useState(false);
  const [showAllRoutes, setShowAllRoutes] = useState(false);
  const [routesQueryExecuted, setRoutesQueryExecuted] = useState(false); // Track if getRoutes was called
  // ✅ Form with zod
  const form = useForm<SendAmountFormSchemaType>({
    resolver: zodResolver(sendAmountFormSchema),
    defaultValues: {
      sendAmount: "",
    },
  });

  const fromAmount = form.watch("sendAmount");
  const debouncedFromAmount = useDebounce(fromAmount, 1000); // 1 second debounce

  // Fetch tokens
  const { data: fromTokensData, isLoading: fromTokensLoading } =
    useQuery<TokensResponse>({
      queryKey: ["fromTokens", fromChain],
      queryFn: async () => await getTokens({ chains: [fromChain] }),
      staleTime: 45_000,
      gcTime: 1000 * 60 * 10,
    });

  const { data: toTokensData, isLoading: toTokensLoading } =
    useQuery<TokensResponse>({
      queryKey: ["toTokens", toChain],
      queryFn: async () => await getTokens({ chains: [toChain] }),
      staleTime: 45_000,
      gcTime: 1000 * 60 * 10,
    });

  useEffect(() => {
    if (fromTokensData?.tokens[fromChain]) {
      const chainTokens = fromTokensData.tokens[fromChain];
      const token = chainTokens.find((t) => t.address === fromTokenAddress);
      const native = chainTokens.find(
        (t) => t.address === "0x0000000000000000000000000000000000000000",
      );
      setFromToken(token || native || chainTokens[0]);
    }
  }, [fromTokensData, fromChain, fromTokenAddress]);

  useEffect(() => {
    if (toTokensData?.tokens[toChain]) {
      const chainTokens = toTokensData.tokens[toChain];
      const token = chainTokens.find((t) => t.address === toTokenAddress);
      const native = chainTokens.find(
        (t) => t.address === "0x0000000000000000000000000000000000000000",
      );
      setToToken(token || native || chainTokens[0]);
    }
  }, [toTokensData, toChain, toTokenAddress]);

  // Fetch routes with React Query
  const {
    data: routesData,
    isLoading: routesLoading,
    refetch: refetchRoutes,
    error: routesError,
  } = useQuery({
    queryKey: [
      "routes",
      fromChain,
      toChain,
      fromToken?.address,
      toToken?.address,
      debouncedFromAmount,
      address,
    ],
    queryFn: async (): Promise<RoutesResponse | { routes: never[] }> => {
      if (
        !fromToken ||
        !toToken ||
        !debouncedFromAmount ||
        parseFloat(debouncedFromAmount) <= 0 ||
        !address
      ) {
        return { routes: [] };
      }

      const request: RoutesRequest = {
        fromChainId: fromChain,
        fromTokenAddress: fromToken.address,
        fromAmount: parseUnits(
          debouncedFromAmount,
          fromToken.decimals,
        ).toString(),
        toChainId: toChain,
        toTokenAddress: toToken.address,
        fromAddress: address,
        toAddress: address,
      };
      setRoutesQueryExecuted(true); // Mark that getRoutes was called
      return await getRoutes(request);
    },
    enabled: Boolean(
      fromToken &&
        toToken &&
        debouncedFromAmount &&
        parseFloat(debouncedFromAmount) > 0 &&
        address,
    ),
    staleTime: 30_000, // 30 seconds
    retry: 2,
  });

  const handleRouteSelect = useCallback((route: Route) => {
    setSelectedRoute(route);
  }, []);

  // Handle routes errors
  useEffect(() => {
    if (routesError) {
      console.error("Error fetching routes:", routesError);
      toast.error("Failed to fetch routes");
    }
  }, [routesError]);

  const routes = routesData?.routes || [];

  const requestVerificationCode = async (
    method: VerificationMethod,
    context = verificationContext,
  ) => {
    const channel = getOtpChannelForMethod(method);
    if (!channel) {
      setOtpSent(true);
      return;
    }
    setIsRequestingOtp(true);
    try {
      const response = await transferService.requestOTP(context, channel);
      setOtpSent(true);
      toast.success(
        response.data?.message ||
          `Verification code sent by ${channel === "sms" ? "SMS" : "email"}.`,
      );
    } catch (error) {
      setOtpSent(false);
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to send a verification code.",
      );
    } finally {
      setIsRequestingOtp(false);
    }
  };

  /**
   * LI.FI remains the quote source, while the backend prepares and records execution so
   * sponsored smart-account transactions and verification use the same server policy.
   */
  const executeSwap = async (verification?: {
    verificationCode: string;
    verificationType: VerificationMethod;
    context: "bridge" | "transfer";
  }) => {
    if (!selectedRoute || !fromToken || !toToken) return;

    const fromChainKey = getChainKeyById(fromChain);
    const toChainKey = getChainKeyById(toChain);
    const symbol = fromToken.symbol.toUpperCase();

    if (!fromChainKey || !toChainKey) {
      toast.error("This network pair is not supported yet.");
      return;
    }
    if (!BRIDGEABLE_SYMBOLS.includes(symbol)) {
      toast.error(
        `${symbol} cannot be bridged yet — only USDC and USDT are supported.`,
      );
      return;
    }
    if (!wallets.length) {
      toast.error("Your wallet is not ready. Please reload and try again.");
      return;
    }

    setIsBridging(true);
    beginOperation(Boolean(verification));
    try {
      const chainBlocked =
        chainStatus.blockedMessage(fromChainKey, "out") ||
        chainStatus.blockedMessage(toChainKey, "in");
      if (chainBlocked) throw new Error(chainBlocked);

      const planRes = await bridgeService.calculatePlan({
        symbol: symbol as "USDC" | "USDT",
        amount: fromAmount,
        selectedChains: [fromChainKey],
        targetChain: toChainKey,
      });
      if (planRes.insufficientBalances) {
        throw new Error(
          `You do not have enough ${symbol} on ${fromChainKey} for this transfer.`,
        );
      }

      const execRes = await bridgeService.executePlan(
        planRes,
        toChainKey,
        undefined,
        verification?.context === "bridge"
          ? {
              verificationCode: verification.verificationCode,
              verificationType: verification.verificationType,
              verificationCodes: [
                {
                  type: verification.verificationType,
                  code: verification.verificationCode,
                },
              ],
            }
          : undefined,
      );
      const calls = execRes.transactions || [];
      if (!calls.length)
        throw new Error(
          "No executable transaction was returned for this route.",
        );

      let txHash = "";
      if (fromChainKey === "stellar") {
        for (const call of calls) {
          if (!call.data)
            throw new Error("Stellar bridge transaction payload is missing.");
          const result = await yieldService.executeStellar(
            "bridge",
            fromAmount,
            call.data,
            "supply",
          );
          txHash = result.data?.txHash || "";
          if (!txHash) throw new Error("Stellar bridge execution failed.");
        }
      } else {
        const signer = resolveEvmSigner(wallets, profile?.chainAccounts);
        if (!signer)
          throw new Error(
            "Your wallet is not available on this device. Please log out and log in again.",
          );
        const client = await getSmartAccountClient(
          signer,
          fromChainKey,
          expectedSafeFor(profile?.chainAccounts, fromChainKey),
        );
        if (!client)
          throw new Error(
            `Failed to initialize your wallet on ${fromChainKey}.`,
          );
        setStickyVerificationCode(
          verification?.context === "transfer"
            ? {
                type: verification.verificationType,
                code: verification.verificationCode,
              }
            : null,
        );
        const sender = client as unknown as {
          sendTransaction(args: Record<string, unknown>): Promise<string>;
        };
        txHash = await sender.sendTransaction({
          account: client.account!,
          calls: calls.map((call) => ({
            to: call.to as `0x${string}`,
            data: (call.data || "0x") as `0x${string}`,
            value: BigInt(call.value || "0"),
          })),
        });
      }
      if (!txHash) throw new Error("The transaction failed to broadcast.");

      const provider = execRes.steps?.[0]?.bridgeProvider;
      const tracked =
        fromChainKey !== toChainKey &&
        profile?.id &&
        (provider === "lifi" ||
          provider === "allbridge" ||
          provider === "cctp");
      if (tracked) {
        bridgeOutbox.save(profile.id, {
          txHash,
          provider: provider as BridgeProvider,
          fromChain: fromChainKey,
          toChain: toChainKey,
          amount: fromAmount,
          symbol,
        });
        void bridgeOutbox.flush(profile.id);
      }

      setVerificationType(null);
      setVerificationMethods([]);
      endOperation();
      toast.success(
        fromChainKey === toChainKey
          ? "Swap submitted."
          : "Bridge submitted. Funds will arrive on the destination chain shortly.",
      );
      form.reset();
      setSelectedRoute(null);
    } catch (error) {
      setStickyVerificationCode(null);
      const challenge = findTransferVerificationRequiredError(error);
      if (challenge) {
        const context = challenge.action === "transfer" ? "transfer" : "bridge";
        const methods = getAvailableVerificationMethods(
          challenge.availableMethods,
          challenge.verificationType,
        );
        const method = methods.includes("email_otp") ? "email_otp" : methods[0];
        setVerificationContext(context);
        setVerificationMethods(methods);
        setVerificationType(method);
        setOtpSent(method === "totp");
        if (method !== "totp") void requestVerificationCode(method, context);
        return;
      }
      endOperation();
      console.error("Swap error:", error);
      toast.error(
        error instanceof Error ? error.message : "Transaction failed",
      );
    } finally {
      setIsBridging(false);
    }
  };

  // const executeSwap = async () => {
  //   if (!selectedRoute || !address || !fromToken || !walletClient) return
  //   setIsBridging(true)

  //   try {
  //     if (chainId !== fromChain) {
  //       await switchChain({ chainId: fromChain })
  //     }

  //     const requiredAmount = parseUnits(debouncedFromAmount, fromToken.decimals)

  //     const allowance = await getTokenAllowance(
  //       fromToken,
  //       address,
  //       selectedRoute.steps[0].estimate.approvalAddress as `0x${string}`,
  //     )

  //     if (allowance === undefined || allowance < requiredAmount) {
  //       toast.loading("Approving token...")

  //       try {
  //         await setTokenAllowance({
  //           walletClient,
  //           token: fromToken,
  //           spenderAddress: selectedRoute.steps[0].estimate
  //             .approvalAddress as `0x${string}`,
  //           amount: requiredAmount,
  //           infiniteApproval: false,
  //         })
  //         toast.success("Approval successful ✅")
  //       } catch (err) {
  //         toast.error("Approval failed ❌")
  //         setIsBridging(false)
  //         return
  //       } finally {
  //         toast.dismiss()
  //       }
  //     }

  //     await executeRoute(selectedRoute, {
  //       updateRouteHook: (updatedRoute) => {
  //         console.log("updatedRoute", updatedRoute)
  //       },
  //     })
  //   } catch (error) {
  //     console.error("Swap error:", error)
  //     toast.error("Transaction failed")
  //   } finally {
  //     setIsBridging(false)
  //   }
  // }

  const handleChainSelectOpen = (side: "from" | "to") => {
    setSelectingSide(side);
    setIsChainSelectOpen(!isChainSelectOpen);
  };

  const swapChains = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("fromChain", toChain.toString());
    params.set("toChain", fromChain.toString());

    if (fromToken) params.set("toToken", fromToken.address);
    if (toToken) params.set("fromToken", toToken.address);

    router.push(`/?${params.toString()}`);
  };

  const isBridge =
    (selectedRoute &&
      selectedRoute.steps.some((step) =>
        step.includedSteps.some(
          (includedStep) => includedStep.type === "cross",
        ),
      )) ||
    fromChain !== toChain;

  const isRouteOptionsActive = routes?.length > 0;

  const handleRefetchRoute = () => {
    setIsRefetched((prev) => !prev);
    refetchRoutes();
  };

  const isModifyBorderRadius =
    isRouteOptionsActive ||
    routesLoading ||
    (routesQueryExecuted && !routesLoading && fromAmount !== "");

  const toggleShowAllRoutes = () => {
    setShowAllRoutes((prev) => !prev);
  };

  const handleGoBackToRouteOptions = () => {
    setSelectedRoute(null);
    // Only toggle showAllRoutes on mobile screens
    if (isMobile && !showAllRoutes) {
      toggleShowAllRoutes();
    }
  };

  return (
    <section className={cn(className)}>
      {isChainSelectOpen ? (
        <ChainSelect
          side={selectingSide!}
          selectedChain={selectingSide === "from" ? fromChain : toChain}
          handleChainSelectOpen={handleChainSelectOpen}
          tokens={
            selectingSide === "from"
              ? fromTokensData?.tokens[fromChain]
              : toTokensData?.tokens[toChain]
          }
          loading={
            selectingSide === "from" ? fromTokensLoading : toTokensLoading
          }
          selectedToken={selectingSide === "from" ? fromToken : toToken}
        />
      ) : showAllRoutes ? (
        <RoutesCard
          routes={routes}
          chains={chains}
          onRouteSelect={handleRouteSelect}
          handleRefetchRoute={handleRefetchRoute}
          isRefetched={isRefetched}
          showAllRoutes={showAllRoutes}
          toggleShowAllRoutes={toggleShowAllRoutes}
        />
      ) : (
        <div className="lg:flex space-x-1">
          <Card
            className={cn(
              "w-[90dvw] xm:max-w-[350px] md:max-w-[414px] lg:w-md xl:max-w-lg mx-auto bg-white dark:bg-secondary-10 rounded-2xl text-gray-20 dark:text-gray-40 border-input px-0!",
              isModifyBorderRadius && !selectedRoute && "lg:rounded-r-none",
            )}
          >
            {/* Header */}
            <CardHeader className="px-2 xs:px-4 md:px-6">
              {selectedRoute ? (
                <div className="flex justify-between items-center text-black dark:text-white">
                  <ArrowLeft
                    onClick={() => handleGoBackToRouteOptions()}
                    className="cursor-pointer"
                  />
                  <CardTitle className="text-lg font-semibold">
                    {isBridge ? "Review bridge" : "Review swap"}
                  </CardTitle>
                  <RotateCw
                    onClick={handleRefetchRoute}
                    className={cn(
                      "w-5 h-5 cursor-pointer",
                      isRefetched && "rotate-360 duration-300",
                    )}
                  />
                </div>
              ) : (
                <div className="flex justify-between items-center text-black dark:text-white">
                  <CardTitle className="text-lg font-semibold ">Swap</CardTitle>
                  <div className="flex items-center space-x-3 cursor-pointer">
                    <FileClock className="w-5 h-5" />
                    <Settings className="w-5 h-5" />
                  </div>
                </div>
              )}
            </CardHeader>

            {/* Content */}
            {selectedRoute ? (
              <SelectedRoute
                selectedRoute={selectedRoute}
                chains={chains}
                isBridging={isBridge}
              />
            ) : (
              <>
                <CardContent className="px-2 xs:px-4 md:px-6 relative">
                  <div className="relative space-y-2">
                    {/* From + To Section */}
                    <SwapBox
                      chains={chains}
                      fromChain={fromChain}
                      toChain={toChain}
                      fromToken={fromToken}
                      toToken={toToken}
                      handleChainSelectOpen={handleChainSelectOpen}
                    />

                    {/* Switch Button */}
                    <button
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg z-10 bg-white dark:bg-secondary-60 border-3 border-white1 dark:border-secondary-10 h-9 w-17 lg:h-12 lg:w-20 flex items-center justify-center ring ring-inset ring-input dark:ring-input cursor-pointer group"
                      onClick={swapChains}
                    >
                      <Icons.ArrowUpDown className="h-6 w-6 text-black dark:text-white group-hover:rotate-180 group-hover:duration-300" />
                    </button>
                  </div>

                  {/* send */}
                  <SendAmount
                    fromChain={fromChain}
                    fromToken={fromToken}
                    toToken={toToken}
                    chains={chains}
                    form={form}
                  />
                </CardContent>

                {/* Mobile Route Options - Inside the main card */}
                <div className="lg:hidden">
                  {routesLoading ? (
                    <CardContent className="p-4 space-y-3 border-t">
                      {[...Array(2)].map((_, index) => (
                        <RouteOptionSkeleton key={`mobile-skeleton-${index}`} />
                      ))}
                    </CardContent>
                  ) : routes?.length > 0 ? (
                    <RouteOptionsMobile
                      routes={routes}
                      chains={chains}
                      isRefetched={isRefetched}
                      handleRefetchRoute={handleRefetchRoute}
                      onRouteSelect={handleRouteSelect}
                      showAllRoutes={showAllRoutes}
                      toggleShowAllRoutes={toggleShowAllRoutes}
                    />
                  ) : routesQueryExecuted && fromAmount !== "" ? (
                    <CardContent className="p-4 border-t">
                      <NoRoutesAvailable
                        onRetry={refetchRoutes}
                        isLoading={routesLoading}
                        // compact={true}
                      />
                    </CardContent>
                  ) : null}
                </div>
              </>
            )}

            {/* Footer */}
            <CardFooter className="px-2 xs:px-4 md:px-6 pt-4">
              <Button
                className={cn(
                  "w-full text-white",
                  !selectedRoute ||
                    !isConnected ||
                    (isBridging && "cursor-not-allowed"),
                )}
                variant="link"
                size="lg"
                onClick={() => executeSwap()}
                disabled={
                  !selectedRoute || !isConnected || isBridging || routesLoading
                }
              >
                {routesLoading
                  ? "Finding routes..."
                  : isBridging
                    ? "Submitting..."
                    : isBridge
                      ? "Bridge"
                      : "Swap"}
              </Button>
            </CardFooter>
          </Card>

          {/* Desktop Route Options - Outside the main card */}
          <div className="hidden lg:block">
            {routesLoading ? (
              <Card className="w-md xl:max-w-lg h-full bg-white dark:bg-secondary-10 rounded-2xl lg:rounded-l-none border-input">
                <CardContent className="p-4 space-y-3">
                  {[...Array(3)].map((_, index) => (
                    <RouteOptionSkeleton key={`desktop-skeleton-${index}`} />
                  ))}
                </CardContent>
              </Card>
            ) : routes?.length > 0 && !selectedRoute ? (
              <RoutesCard
                routes={routes}
                chains={chains}
                onRouteSelect={handleRouteSelect}
                handleRefetchRoute={handleRefetchRoute}
                isRefetched={isRefetched}
                showAllRoutes={showAllRoutes}
                toggleShowAllRoutes={toggleShowAllRoutes}
              />
            ) : routesQueryExecuted &&
              !selectedRoute &&
              !routesLoading &&
              fromAmount !== "" ? (
              <NoRoutesAvailable
                onRetry={refetchRoutes}
                isLoading={routesLoading}
                className={cn(isModifyBorderRadius && "lg:rounded-l-none")}
              />
            ) : null}
          </div>
        </div>
      )}

      <TransferVerificationModal
        isOpen={Boolean(verificationType)}
        isSubmitting={isBridging}
        verificationType={verificationType || "email_otp"}
        title={isBridge ? "Verify bridge" : "Verify swap"}
        actionNoun={isBridge ? "bridge" : "swap"}
        selectedMethod={verificationType || "email_otp"}
        availableMethods={verificationMethods}
        onMethodChange={(method) => {
          setVerificationType(method);
          setOtpSent(method === "totp");
          if (method !== "totp") void requestVerificationCode(method);
        }}
        otpSent={otpSent}
        onResend={() =>
          verificationType && requestVerificationCode(verificationType)
        }
        isResending={isRequestingOtp}
        onClose={() => {
          setVerificationType(null);
          setVerificationMethods([]);
          setOtpSent(false);
          endOperation();
        }}
        onSubmit={(verificationCode) => {
          if (!verificationType) return;
          void executeSwap({
            verificationCode,
            verificationType,
            context: verificationContext,
          });
        }}
      />
    </section>
  );
};

export default SwapInterface;
