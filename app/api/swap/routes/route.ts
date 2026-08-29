import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveChains } from "@/lib/chains";
import { lifiRequest } from "@/lib/lifi-server";
import { isNativeToStableSwap } from "@/lib/swap-policy";
import type { Route } from "@/services/api/swap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const requestSchema = z.object({
  fromChainId: z.number().int().positive(),
  toChainId: z.number().int().positive(),
  fromTokenAddress: addressSchema,
  toTokenAddress: addressSchema,
  fromAmount: z
    .string()
    .regex(/^\d+$/)
    .refine((value) => BigInt(value) > 0n, "Amount must be greater than zero"),
  fromAddress: addressSchema,
  toAddress: addressSchema,
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const supportedChainIds = new Set(
      Object.values(getActiveChains())
        .filter((chain) => chain.type === "evm" && typeof chain.id === "number")
        .map((chain) => Number(chain.id)),
    );

    if (
      !supportedChainIds.has(body.fromChainId) ||
      !supportedChainIds.has(body.toChainId) ||
      !isNativeToStableSwap(body)
    ) {
      return NextResponse.json(
        { message: "Unsupported Kellon swap pair" },
        { status: 400 },
      );
    }

    const result = await lifiRequest<{ routes: Route[] }>("/advanced/routes", {
      ...body,
      options: {
        integrator: "Kellon",
        slippage: 0.005,
        order: "CHEAPEST",
        allowSwitchChain: false,
        maxPriceImpact: 0.1,
      },
    });
    return NextResponse.json({ routes: result.routes });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to find swap routes";
    return NextResponse.json({ message }, { status: 400 });
  }
}
