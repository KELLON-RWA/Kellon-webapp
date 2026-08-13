import { NextResponse } from "next/server";
import {
  forwardLifiResponse,
  requestLifi,
  validateBridgeAction,
} from "@/lib/server/lifi-bridge";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    step?: Record<string, unknown>;
  } | null;
  const step = body?.step;
  const action = step?.action as
    | Parameters<typeof validateBridgeAction>[0]
    | undefined;
  if (!step || !action) {
    return NextResponse.json(
      { message: "Invalid bridge step" },
      { status: 400 },
    );
  }

  const validationError = validateBridgeAction(action);
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  const response = await requestLifi("/advanced/stepTransaction", step);
  return forwardLifiResponse(response);
}
