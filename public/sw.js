/* Kellon service worker — web push only. It deliberately does not cache anything. */

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

self.addEventListener("push", (event) => {
  if (!event.data) return

  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = { title: "Kellon", body: event.data.text() }
  }

  const title = payload.title || "Kellon"
  const options = {
    body: payload.body || "",
    icon: "/logo.png",
    badge: "/logo.png",
    data: payload.data || {},
    tag: payload.data?.kellonEvent ? "kellon-update" : undefined,
  }

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options)

      // An open tab already has the socket, so hand it the same envelope rather than
      // letting it discover the change later.
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      for (const client of clients) {
        client.postMessage({ source: "kellon-push", data: payload.data || {} })
      }
    })(),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      for (const client of clients) {
        if ("focus" in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow("/")
    })(),
  )
})
