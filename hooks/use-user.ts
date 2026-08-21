import { getSession } from "@/services/api/auth"
import { syncMyAssets } from "@/services/api/user"
import { User } from "@/types/db"
import { useQuery } from "@tanstack/react-query"

interface UseUserOptions {
  /** Keeps wallet balances and assets synchronized while the dashboard is open. */
  live?: boolean
}

const LIVE_SYNC_THROTTLE_MS = 15_000

let lastAssetSyncAt = 0
let activeAssetSync: Promise<User | null> | null = null

async function syncLiveProfile() {
  const now = Date.now()

  if (activeAssetSync) return activeAssetSync

  if (now - lastAssetSyncAt < LIVE_SYNC_THROTTLE_MS) {
    const session = await getSession()
    return session?.data ?? null
  }

  activeAssetSync = syncMyAssets()
    .then((response) => {
      lastAssetSyncAt = Date.now()
      return response.data ?? null
    })
    .catch(async () => {
      const session = await getSession()
      return session?.data ?? null
    })
    .finally(() => {
      activeAssetSync = null
    })

  return activeAssetSync
}

// hooks/use-user.ts
export function useUser(
  initialData?: User | null,
  options: UseUserOptions = {},
) {
  const live = options.live === true

  return useQuery<User | null>({
    queryKey: ["user-session"],
    queryFn: async () => {
      try {
        if (live) return syncLiveProfile()

        const session = await getSession()
        // Only return null if the backend explicitly says the user is gone
        if (!session?.data) return null
        return session.data
      } catch (error) {
        // If the fetch fails (network error), keep the current data
        // throwing the error allows React Query to keep the "stale" data visible
        throw error
      }
    },
    initialData,
    staleTime: live ? 5_000 : 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30, // Keep in memory for 30 mins even if unused
    // Deposits can land on-chain before the backend emits an event, so live
    // wallet screens ask the backend to reconcile balances periodically.
    refetchInterval: live ? LIVE_SYNC_THROTTLE_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: live,
    refetchOnReconnect: true,
    retry: 1, // Don't give up immediately on one failure
  })
}
