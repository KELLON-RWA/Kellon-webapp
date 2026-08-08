import { getSession } from "@/services/api/auth"
import { User } from "@/types/db"
import { useQuery } from "@tanstack/react-query"

interface UseUserOptions {
  /** Keeps wallet balances and assets synchronized while the dashboard is open. */
  live?: boolean
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
    staleTime: live ? 10_000 : 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30, // Keep in memory for 30 mins even if unused
    // Balances refresh when activity changes, on focus, or after a mutation.
    // A second permanent timer here doubled dashboard network traffic.
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: live,
    refetchOnReconnect: true,
    retry: 1, // Don't give up immediately on one failure
  })
}
