/** Only the bridge's top-level outcome is terminal; a failed mint attempt is retryable. */
export function isTerminalBridgeFailure(result: { status?: string; substatus?: string }): boolean {
  return ["FAILED", "REFUNDED", "CANCELLED", "EXPIRED"].includes(String(result.status || "").toUpperCase());
}
