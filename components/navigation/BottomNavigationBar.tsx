"use client";

import Link from "next/link";
import { FC, HtmlHTMLAttributes } from "react";
import { navigationListUrls } from "./navigationUrl";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/Icons";
import { isActive } from "@/lib/is-active-link";
import { usePathname } from "next/navigation";
import Slab from "@/components/ui/slab";
import UserNavigation from "./user-navigation/UserNavigation";
import { User } from "@/types/db";

interface BottomNavigationBarProps extends HtmlHTMLAttributes<HTMLDivElement> {
  profile: User;
}

const BottomNavigationBar: FC<BottomNavigationBarProps> = ({
  className,
  profile,
}) => {
  // IMP START - Get Current Route Pathname for Active Link Highlighting
  const pathname = usePathname();
  // IMP END - Get Current Route Pathname for Active Link Highlighting
  const HIDDEN_PATHS = [
    "/continue",
    "/settings/profile",
    "/buy",
    "/bridge",
    "/withdraw",
    "/send",
    "/gifts",
    "/receive",
    "/notifications",
    "/transactions",
  ];
  const isDetailFlow =
    pathname === "/assets" ||
    pathname.startsWith("/swap") ||
    pathname.startsWith("/earn/stocks/") ||
    pathname.startsWith("/earn/positions/");

  if (HIDDEN_PATHS.includes(pathname) || isDetailFlow) {
    return null;
  }

  return (
    // IMP START - Bottom Navigation Wrapper (Fixed Position)
    <section className={cn(className, "fixed bottom-0 w-full")}>
      {/* IMP START - Navigation Menu Container */}
      <nav className="bg-white dark:bg-secondary-50  border-t border-input ">
        <ul className="grid grid-cols-5">
          {/* IMP START - Render Navigation Items */}
          {navigationListUrls.map(({ label, href, icon }, i) => {
            const Icon = icon && Icons[icon]; // IMP - Dynamically map icon string to actual component
            return (
              <li key={i} className="relative min-w-0">
                <Slab
                  href={href}
                  className={cn(
                    "absolute left-1/2 top-0 w-10 -translate-x-1/2",
                    className,
                  )}
                />
                <Link
                  href={href}
                  className={cn(
                    // IMP START - Base Styling for Links
                    "flex h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium capitalize text-gray-20 hover:text-black dark:text-gray-40 dark:hover:text-white",
                    // IMP END - Base Styling for Links

                    // IMP START - Apply Active Link Styling
                    isActive(pathname, href) && "text-black dark:text-white",
                    // IMP END - Apply Active Link Styling
                  )}
                >
                  {/* IMP START - Render Icon if Available */}
                  {Icon && (
                    <Icon
                      className={cn(
                        "h-4 w-4 text-gray-20 hover:text-black dark:text-gray-40 dark:hover:text-white",
                        isActive(pathname, href) && "text-black dark:text-white",
                      )}
                    />
                  )}
                  {/* IMP END - Render Icon if Available */}

                  {/* IMP START - Render Label */}
                  <span className="max-w-full truncate">{label}</span>
                  {/* IMP END - Render Label */}
                </Link>
              </li>
            );
          })}
          {
            // profile &&
            <li className="min-w-0">
              <UserNavigation profile={profile} />
            </li>
          }
        </ul>
        {/* IMP END - Render Navigation Items */}
      </nav>
      {/* IMP END - Navigation Menu Container */}
    </section>
    // IMP END - Bottom Navigation Wrapper (Fixed Position)
  );
};

export default BottomNavigationBar;
