import { webPushService } from "@/services/api/web-push"

/** VAPID keys are base64url; the browser wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(normalized)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

export const isWebPushSupported = (): boolean =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isWebPushSupported()) return null
  try {
    return await navigator.serviceWorker.register("/sw.js")
  } catch {
    return null
  }
}

/**
 * Subscribes this browser to web push. Only ever called from an explicit user action —
 * a permission prompt on page load is the fastest way to get permanently denied.
 */
export async function enableWebPush(): Promise<{ ok: boolean; reason?: string }> {
  if (!isWebPushSupported()) return { ok: false, reason: "unsupported" }

  const permission = await Notification.requestPermission()
  if (permission !== "granted") return { ok: false, reason: permission }

  const registration = await registerServiceWorker()
  if (!registration) return { ok: false, reason: "sw_failed" }
  await navigator.serviceWorker.ready

  let keyResponse
  try {
    keyResponse = await webPushService.getPublicKey()
  } catch {
    return { ok: false, reason: "not_configured" }
  }

  const publicKey = keyResponse.data?.publicKey
  if (!publicKey) return { ok: false, reason: "not_configured" }

  // Reuse an existing subscription rather than minting a second one for the same browser.
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    }))

  await webPushService.register(subscription.toJSON(), navigator.userAgent.slice(0, 80))
  return { ok: true }
}

export async function disableWebPush(): Promise<void> {
  if (!isWebPushSupported()) return
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return

  await webPushService.unregister(subscription.endpoint).catch(() => {})
  await subscription.unsubscribe().catch(() => {})
}
