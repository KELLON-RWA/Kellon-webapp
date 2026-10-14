/** Backend announcement/marketing types belong in System, not transaction heuristics. */
export function isSystemNotificationType(type: string): boolean {
  return ["ANNOUNCEMENT", "MARKETING"].includes(type.trim().toUpperCase());
}
