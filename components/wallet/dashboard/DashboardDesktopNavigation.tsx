"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Clock3,
  CreditCard,
  Home,
  Settings,
} from "lucide-react";
import SearchBar from "@/components/SearchBar";
import { Icons } from "@/components/Icons";
import NotificationBell from "@/components/notification/NotificationBell";
import UserNavigation from "@/components/navigation/user-navigation/UserNavigation";
import { cn } from "@/lib/utils";
import type { User } from "@/types/db";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/cards", label: "Cards", icon: CreditCard },
  { href: "/earn", label: "Earn", icon: BarChart3 },
  { href: "/transactions", label: "Activity", icon: Clock3 },
  { href: "/settings/profile", label: "Settings", icon: Settings },
];

export default function DashboardDesktopNavigation({ profile }: { profile: User }) {
  const pathname = usePathname();

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-black/10 bg-white/80 px-3 py-5 backdrop-blur-xl dark:border-white/10 dark:bg-secondary-50/80 min-[1024px]:flex">
        <Link href="/" className="mb-8 flex items-center gap-2 px-2" aria-label="Kellon home">
          <Icons.Logo className="h-9 w-9" />
          <span className="text-xl font-semibold tracking-tight text-cryptoNight dark:text-white">Kellon</span>
        </Link>

        <nav aria-label="Dashboard navigation" className="space-y-1">
          {items.map(({ href, icon: Icon, label }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href.split("?")[0]);
            return (
              <Link
                key={label}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-primary-70/15 text-primary-50 shadow-[inset_0_0_0_1px_rgba(214,100,190,0.18)] dark:text-white"
                    : "text-gray-500 hover:bg-primary-99 hover:text-cryptoNight dark:text-gray-40 dark:hover:bg-white/5 dark:hover:text-white",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 hidden h-[72px] bg-transparent pl-56 pr-6 min-[1024px]:flex min-[1024px]:items-center min-[1024px]:justify-end min-[1024px]:gap-6">
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
