"use client";

import Link from "next/link";
import { FC, HtmlHTMLAttributes } from "react";

// IMP START - App Imports
import { navigationListUrls } from "./navigationUrl";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/Icons";
import { usePathname } from "next/navigation";
import { isActive } from "@/lib/is-active-link";

import NotificationBell from "@/components/notification/NotificationBell";
import UserNavigation from "./user-navigation/UserNavigation";
import SearchBar from "@/components/SearchBar";

import { User } from "@/types/db";

interface TopbarProps extends HtmlHTMLAttributes<HTMLDivElement> {
  profile: User;
}

const Topbar: FC<TopbarProps> = ({ className, profile }) => {
  const pathname = usePathname();

  const HIDDEN_PATHS = ["/continue"];

  if (HIDDEN_PATHS.includes(pathname)) {
    return null;
  }

  return (
    <section
      className={cn(
        className,
        "relative hidden w-full px-4 py-3 md:fixed md:z-50 md:block min-[1024px]:!hidden lg:px-5",
      )}
    >
      <header className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
        {/* Desktop Navigation */}
        <div className="flex min-w-0 gap-2">
          <nav className="hidden w-fit items-center gap-1 rounded-xl border border-gray-80 bg-white/85 p-1 capitalize shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl md:flex dark:border-white/10 dark:bg-secondary-50/35 dark:shadow-none">
            <Link href="/" aria-label="Kellon home" className="cursor-pointer">
              <Icons.Logo className="h-8 w-8" />
            </Link>

            {navigationListUrls.map(({ label, href }, i) => (
              <ul key={i} className="min-w-0">
                <li>
                  <Link
                    href={href}
                    aria-current={isActive(pathname, href) ? "page" : undefined}
                    className={cn(
                      "flex h-8 cursor-pointer items-center rounded-lg px-2.5 text-sm font-semibold text-gray-30 transition-colors hover:text-cryptoNight dark:text-gray-40 dark:hover:text-white lg:px-3",
                      isActive(pathname, href) &&
                        "text-primary-50 dark:text-primary-90",
                    )}
                  >
                    {label}
                  </Link>
                </li>
              </ul>
            ))}
          </nav>
        </div>

        {/* Desktop Controls */}
        <ul className="hidden min-w-0 items-center gap-2 md:flex">
          <li className="min-w-0">
            <SearchBar
              profile={profile}
              className="md:max-w-[320px] min-[1024px]:max-w-[360px] lg:max-w-sm"
            />
          </li>
          <li>
            <div className="flex items-center overflow-hidden rounded-xl border border-gray-80 bg-white/85 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-secondary-50/35 dark:shadow-none">
              <NotificationBell />
            </div>
          </li>

          <li>{profile && <UserNavigation profile={profile} />}</li>
        </ul>
      </header>
    </section>
  );
};

export default Topbar;
