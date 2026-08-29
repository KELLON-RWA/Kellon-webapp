import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveChains } from "@/lib/chains";
import { lifiRequest } from "@/lib/lifi-server";
import { isNativeToStableSwap } from "@/lib/swap-policy";
import type { LiFiStep } from "@/services/api/swap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stepSchema = z.object({
  step: z
    .object({
      action: z
        .object({
          fromChainId: z.number().int().positive(),
          toChainId: z.number().int().positive(),
          fromToken: z.object({ address: z.string() }).passthrough(),
          toToken: z.object({ address: z.string() }).passthrough(),
        })
        .passthrough(),
    })
    .passthrough(),
});

export async function POST(request: Request) {
  try {
    const { step } = stepSchema.parse(await request.json());
    const supportedChainIds = new Set(
      Object.values(getActiveChains())
        .filter((chain) => chain.type === "evm" && typeof chain.id === "number")
        .map((chain) => Number(chain.id)),
    );
    if (
      !supportedChainIds.has(step.action.fromChainId) ||
      !supportedChainIds.has(step.action.toChainId) ||
      !isNativeToStableSwap({
        fromChainId: step.action.fromChainId,
        toChainId: step.action.toChainId,
        fromTokenAddress: step.action.fromToken.address,
        toTokenAddress: step.action.toToken.address,
      })
    ) {
      return NextResponse.json(
        { message: "Unsupported Kellon swap transaction" },
        { status: 400 },
      );
    }

    const executableStep = await lifiRequest<LiFiStep>(
      "/advanced/stepTransaction",
      step,
    );
    return NextResponse.json({ step: executableStep });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to prepare swap";
    return NextResponse.json({ message }, { status: 400 });
  }
}
