import { NextResponse } from "next/server";
import {
  forwardLifiResponse,
  requestLifi,
  validateBridgeAction,
} from "@/lib/server/lifi-bridge";

type RoutesBody = {
  fromChainId?: unknown;
  toChainId?: unknown;
  fromTokenAddress?: unknown;
  toTokenAddress?: unknown;
  fromAmount?: unknown;
  fromAddress?: unknown;
  toAddress?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RoutesBody | null;
  if (!body)
    return NextResponse.json(
      { message: "Invalid bridge request" },
      { status: 400 },
    );

  const validationError = validateBridgeAction({
    fromChainId: body.fromChainId,
    toChainId: body.toChainId,
    fromAmount: body.fromAmount,
    fromToken: { address: body.fromTokenAddress },
    toToken: { address: body.toTokenAddress },
    fromAddress: body.fromAddress,
    toAddress: body.toAddress,
  });
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  const response = await requestLifi("/advanced/routes", {
    ...body,
    options: {
      integrator: "Kellon",
      order: "CHEAPEST",
      slippage: 0.005,
      allowSwitchChain: true,
    },
  });
  return forwardLifiResponse(response);
}
