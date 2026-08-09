import { getSession } from "@/services/api/auth"
import { cookies } from "next/headers"
import { cache } from "react"

/**
 * Deduped per request: the layout and the page both call this, so without cache() every
 * navigation issues duplicate /users/me calls — and router.refresh() on each realtime
 * event would multiply them further.
 */
export const currentProfile = cache(async () => {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get("session_token")?.value

  const session = await getSession(sessionToken)
  if (!session) return null

  const profile = session.data
  return profile
})
