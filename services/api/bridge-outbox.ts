import { isTerminalBridgeFailure } from "@/lib/bridge-status";
import { bridgeService, type BridgeProvider } from "./bridge";

/**
 * Durable browser outbox for bridge tracking. A broadcast hash is written here before the first
 * tracking attempt, so a closed tab, dropped request or lost connection never loses the bridge.
 * Entries are retried until the backend acknowledges tracking or the bridge reaches a verified
 * terminal state. The backend track request is idempotent and never rebinds a tracked hash.
 */
export interface BridgeOutboxJob {
  txHash: string;
  provider: BridgeProvider;
  fromChain: string;
  toChain: string;
  amount: string;
  symbol: string;
  groupId?: string;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
}

const PREFIX = "kellon:bridge:";

const keyFor = (userId: string, txHash: string) => `${PREFIX}${userId}:${txHash}`;
const backoffMs = (attempts: number) => Math.min(15_000 * 2 ** Math.min(attempts, 6), 15 * 60_000);

const canStore = () => typeof window !== "undefined" && !!window.localStorage;

export interface BridgeOutboxFlushResult {
  completed: number;
  failed: number;
  pending: number;
}

export const bridgeOutbox = {
  keyFor,

  list(userId: string): BridgeOutboxJob[] {
    if (!canStore()) return [];
    const jobs: BridgeOutboxJob[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(`${PREFIX}${userId}:`)) continue;
      try {
        const job = JSON.parse(localStorage.getItem(key) || "null");
        if (job?.txHash) jobs.push(job);
      } catch {
        // Ignore a corrupted entry; it cannot be resumed.
      }
    }
    return jobs;
  },

  save(userId: string, job: Omit<BridgeOutboxJob, "attempts" | "nextAttemptAt" | "lastError">): void {
    if (!canStore()) return;
    let attempts = 0;
    try {
      const existing = JSON.parse(localStorage.getItem(keyFor(userId, job.txHash)) || "null");
      attempts = existing?.attempts || 0;
    } catch {
      attempts = 0;
    }
    localStorage.setItem(keyFor(userId, job.txHash), JSON.stringify({ ...job, attempts, nextAttemptAt: 0 }));
  },

  remove(userId: string, txHash: string): void {
    if (!canStore()) return;
    localStorage.removeItem(keyFor(userId, txHash));
  },

  /** Track, then observe, every due job. Terminal states clear the entry. */
  async flush(userId: string): Promise<BridgeOutboxFlushResult> {
    if (!canStore()) return { completed: 0, failed: 0, pending: 0 };
    let completed = 0;
    let failed = 0;
    let pending = 0;
    const now = Date.now();
    for (const job of bridgeOutbox.list(userId)) {
      if (job.nextAttemptAt > now) {
        pending += 1;
        continue;
      }
      const key = keyFor(userId, job.txHash);
      try {
        await bridgeService.track({
          txHash: job.txHash,
          provider: job.provider,
          fromChain: job.fromChain,
          toChain: job.toChain,
          amount: job.amount,
          symbol: job.symbol,
          groupId: job.groupId,
        });
        const status = await bridgeService.getStatus({
          provider: job.provider,
          txHash: job.txHash,
          fromChain: job.fromChain,
          toChain: job.toChain,
          amount: job.amount,
          symbol: job.symbol,
          groupId: job.groupId,
        });
        if (status.status?.toUpperCase() === "COMPLETED") {
          localStorage.removeItem(key);
          completed += 1;
          continue;
        }
        if (isTerminalBridgeFailure(status)) {
          localStorage.removeItem(key);
          failed += 1;
          continue;
        }
        // Tracking acknowledged; keep observing at the outbox cadence.
        localStorage.setItem(key, JSON.stringify({ ...job, attempts: 0, lastError: undefined, nextAttemptAt: Date.now() + 15_000 }));
        pending += 1;
      } catch (error: unknown) {
        const attempts = (job.attempts || 0) + 1;
        const lastError = String((error as Error)?.message || error).slice(0, 300);
        localStorage.setItem(key, JSON.stringify({ ...job, attempts, lastError, nextAttemptAt: Date.now() + backoffMs(attempts) }));
        pending += 1;
      }
    }
    return { completed, failed, pending };
  },
};
