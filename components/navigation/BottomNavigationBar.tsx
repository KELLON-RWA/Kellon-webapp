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
    "/withdraw",
    "/send",
    "/gifts",
    "/receive",
    "/notifications",
    "/transactions",
  ];

  if (HIDDEN_PATHS.includes(pathname)) {
    return null;
  }

  return (
    // IMP START - Bottom Navigation Wrapper (Fixed Position)
    <section className={cn(className, "fixed bottom-0 w-full")}>
      {/* IMP START - Navigation Menu Container */}
      <nav className="bg-white dark:bg-secondary-50  border-t border-input ">
        <ul className="flex justify-around ">
          {/* IMP START - Render Navigation Items */}
          {navigationListUrls.map(({ label, href, icon }, i) => {
            const Icon = icon && Icons[icon]; // IMP - Dynamically map icon string to actual component
            return (
              <li key={i}>
                <Slab href={href} className={cn(className)} />
                <Link
                  href={href}
                  className={cn(
                    // IMP START - Base Styling for Links
                    "cursor-pointer text-gray-20 dark:text-gray-40 hover:text-black dark:hover:text-white capitalize text-xs font-medium ",
                    // IMP END - Base Styling for Links

                    // IMP START - Apply Active Link Styling
                    isActive(pathname, href) && "text-black dark:text-white",
                    // IMP END - Apply Active Link Styling
                  )}
                >
                  <div className="py-4 flex flex-col space-y-1 items-center">
                    {/* IMP START - Render Icon if Available */}
                    {Icon && (
                      <Icon
                        className={cn(
                          "text-gray-20 dark:text-gray-40 hover:text-black dark:hover:text-white h-4 w-4",
                          isActive(pathname, href) &&
                            "text-black dark:text-white", // IMP - Apply active color to icon
                        )}
                      />
                    )}
                    {/* IMP END - Render Icon if Available */}

                    {/* IMP START - Render Label */}
                    <span>{label}</span>
                    {/* IMP END - Render Label */}
                  </div>
                </Link>
              </li>
            );
          })}
          {
            // profile &&
            <li>
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
