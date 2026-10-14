"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { useNotifications, useMarkAsRead } from "@/hooks/use-notifications";
import { getFeaturedSystemNotifications } from "@/lib/featured-system-notifications";
import NotificationDetailModal from "@/components/modals/NotificationDetailModal";
import type { Notification } from "@/types/db";

export default function SystemUpdatesPanel() {
  const { data: notifications = [], isLoading, error } = useNotifications();
  const { mutate: markAsRead } = useMarkAsRead();
  const [selected, setSelected] = useState<Notification | null>(null);
  const [index, setIndex] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const updates = getFeaturedSystemNotifications(notifications);
  const activeIndex = Math.min(index, Math.max(0, updates.length - 1));

  const updateCount = updates.length;
  const scrollToUpdate = useCallback(
    (nextIndex: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const target = Math.max(0, Math.min(updateCount - 1, nextIndex));
      viewport.scrollTo({
        top: target * viewport.clientHeight,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    },
    [updateCount],
  );

  useEffect(() => {
    if (isLoading || error || selected || updateCount < 2) return;

    const interval = window.setInterval(() => {
      const viewport = viewportRef.current;
      if (!viewport?.clientHeight || document.hidden) return;
      const currentIndex = Math.round(
        viewport.scrollTop / viewport.clientHeight,
      );
      scrollToUpdate((currentIndex + 1) % updateCount);
    }, 5_000);

    return () => window.clearInterval(interval);
  }, [isLoading, error, selected, updateCount, scrollToUpdate]);

  if (error || (!isLoading && !updates.length)) return null;

  return (
    <>
      <section aria-label="Featured system updates" className="order-3 w-full">
        {isLoading ? (
          <div
            role="status"
            aria-label="Loading system updates"
            className="min-h-[80px] animate-pulse rounded-[20px] border border-primary-70/30 bg-white/80 dark:bg-secondary-50"
          />
        ) : (
          <div className="relative overflow-hidden rounded-[20px] border border-primary-70/30 bg-white/80 dark:bg-black2/60">
            <div
              ref={viewportRef}
              tabIndex={0}
              role="region"
              aria-label="System updates. Swipe up or down to browse."
              className="h-[80px] touch-pan-y snap-y snap-mandatory overflow-y-auto overscroll-y-contain [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-70 [&::-webkit-scrollbar]:hidden"
              onScroll={(event) => {
                const viewport = event.currentTarget;
                if (viewport.clientHeight)
                  setIndex(
                    Math.round(viewport.scrollTop / viewport.clientHeight),
                  );
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  scrollToUpdate(
                    activeIndex + (event.key === "ArrowDown" ? 1 : -1),
                  );
                } else if (event.key === "Home" || event.key === "End") {
                  event.preventDefault();
                  scrollToUpdate(event.key === "Home" ? 0 : updates.length - 1);
                }
              }}
            >
              {updates.map((notification, updateIndex) => (
                <button
                  key={notification.id}
                  type="button"
                  tabIndex={updateIndex === activeIndex ? 0 : -1}
                  className="group relative flex h-[80px] w-full shrink-0 cursor-pointer snap-start snap-always items-center gap-3 overflow-hidden py-3 pl-10 pr-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-70 sm:gap-4 sm:pr-5"
                  onClick={() => {
                    setSelected(notification);
                    if (!notification.readAt)
                      markAsRead(notification.id, {
                        onError: () =>
                          toast.error("Could not mark this update as read"),
                      });
                  }}
                >
                  <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-95 text-primary-60 dark:bg-primary-70/15 dark:text-primary-80">
                    <Bell className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="relative z-10 min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="line-clamp-2 text-sm font-semibold leading-5 text-cryptoNight dark:text-white">
                        {notification.subject || "Kellon update"}
                      </span>
                      {!notification.readAt && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-60"
                          aria-label="Unread"
                        />
                      )}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 min-[1024px]:group-hover:translate-x-full motion-reduce:hidden"
                  />
                </button>
              ))}
            </div>
            {updates.length > 1 && (
              <div
                className="absolute left-2 top-1/2 flex -translate-y-1/2 flex-col items-center"
                aria-label="Choose featured update"
              >
                {updates.map((notification, updateIndex) => (
                  <button
                    key={notification.id}
                    type="button"
                    aria-label={`Show update: ${notification.subject || "Kellon update"}`}
                    aria-pressed={updateIndex === activeIndex}
                    className="flex h-3 w-6 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-70"
                    onClick={() => scrollToUpdate(updateIndex)}
                  >
                    <span
                      className={
                        updateIndex === activeIndex
                          ? "h-3 w-1 rounded-full bg-primary-70 transition-all motion-reduce:transition-none"
                          : "h-1 w-1 rounded-full bg-gray-60 transition-all dark:bg-white/20 motion-reduce:transition-none"
                      }
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            )}
            <span className="sr-only" aria-live="polite">
              {updates[activeIndex]?.subject || "Kellon update"}
            </span>
          </div>
        )}
      </section>
      <NotificationDetailModal
        isOpen={Boolean(selected)}
        notification={selected}
        display={
          selected
            ? {
                category: "System",
                icon: "✓",
                title: selected.subject || "Kellon update",
                content: selected.content || null,
              }
            : null
        }
        onClose={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
}
