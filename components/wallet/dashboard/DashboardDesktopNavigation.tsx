"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Clock3,
  CreditCard,
  Home,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from "lucide-react";
import SearchBar from "@/components/SearchBar";
import NotificationBell from "@/components/notification/NotificationBell";
import UserNavigation from "@/components/navigation/user-navigation/UserNavigation";
import { Icons } from "@/components/Icons";
import { cn } from "@/lib/utils";
import type { User } from "@/types/db";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/cards", label: "Cards", icon: CreditCard },
  { href: "/earn", label: "Earn", icon: Icons.Earn },
  { href: "/transactions", label: "Activity", icon: Clock3 },
  { href: "/settings/profile", label: "Settings", icon: Settings },
];

export default function DashboardDesktopNavigation({ profile }: { profile: User }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== "undefined" && window.localStorage.getItem("kellon-desktop-sidebar-collapsed") === "true",
  );

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--desktop-sidebar-width",
      collapsed ? "4.75rem" : "14rem",
    );
    window.localStorage.setItem("kellon-desktop-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-black/10 bg-white/80 py-5 backdrop-blur-xl transition-[width,padding] duration-200 dark:border-white/10 dark:bg-secondary-50/80 min-[1024px]:flex",
          collapsed ? "w-[4.75rem] px-2" : "w-56 px-3",
        )}
      >
        <div className={cn("mb-8 flex", collapsed ? "flex-col items-center gap-3" : "items-center justify-between gap-2 px-2")}>
          <Link href="/" className="flex items-center gap-2" aria-label="Kellon home">
            <Image
              src="/logo.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0"
              priority
            />
            {!collapsed && (
              <span className="text-xl font-semibold tracking-tight text-cryptoNight dark:text-white">Kellon</span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="cursor-pointer rounded-md p-1.5 text-gray-500 transition hover:bg-primary-99 hover:text-cryptoNight dark:text-gray-40 dark:hover:bg-white/5 dark:hover:text-white"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          </button>
        </div>

        <nav aria-label="Dashboard navigation" className="space-y-1">
          {items.map(({ href, icon: Icon, label }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href.split("?")[0]);
            return (
              <Link
                key={label}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center rounded-lg py-2.5 text-sm font-medium transition",
                  collapsed ? "justify-center px-0" : "gap-3 px-3",
                  active
                    ? "bg-primary-70/15 text-primary-50 shadow-[inset_0_0_0_1px_rgba(214,100,190,0.18)] dark:text-white"
                    : "text-gray-500 hover:bg-primary-99 hover:text-cryptoNight dark:text-gray-40 dark:hover:bg-white/5 dark:hover:text-white",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className={collapsed ? "sr-only" : undefined}>{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 hidden h-[72px] bg-transparent pr-6 min-[1024px]:flex min-[1024px]:items-center min-[1024px]:justify-end min-[1024px]:gap-6 min-[1024px]:pl-[var(--desktop-sidebar-width)]">
        <div className="flex items-center gap-2">
          <SearchBar profile={profile} className="w-[360px]" />
          <div className="rounded-xl border border-black/10 bg-white/70 dark:border-white/10 dark:bg-secondary-50/55">
            <NotificationBell />
          </div>
          <UserNavigation profile={profile} />
        </div>
      </header>
    </>
  );
}
