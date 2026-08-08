import { FC } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { LinkItemProps, NavItemProps } from "./user-navigation-types"


export const SectionHeader: FC<{ label: string }> = ({ label }) => (
  <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-30 dark:text-secondary-90">
    {label}
  </p>
)

export const NavigationItem: FC<NavItemProps> = ({
  icon,
  label,
  subLabel,
  onClick,
}) => (
  <button
    onClick={(e) => {
      e.preventDefault()
      onClick()
    }}
    className="w-full flex items-center justify-between p-3 hover:bg-gray-95 dark:hover:bg-secondary-60 rounded-sm transition-colors group cursor-pointer outline-none text-left"
  >
    <div className="flex items-center gap-3">
      <div className="text-primary-70">{icon}</div>
      <div>
        <p className="text-xs font-bold text-black dark:text-white">{label}</p>
        {subLabel && (
          <p className="text-[10px] text-gray-20 dark:text-secondary-90">
            {subLabel}
          </p>
        )}
      </div>
    </div>
    <ChevronRight className="w-4 h-4 text-gray-30 group-hover:translate-x-0.5 transition-transform" />
  </button>
)

export const LinkItem: FC<LinkItemProps> = ({
  icon,
  label,
  subLabel,
  href,
  onClick,
}) => (
  <Link
    href={href}
    onClick={onClick}
    className="w-full flex items-center justify-between p-3 hover:bg-gray-95 dark:hover:bg-secondary-60 rounded-sm transition-colors group cursor-pointer outline-none"
    target={href.startsWith("/") ? undefined : "_blank"}
    rel={href.startsWith("/") ? undefined : "noreferrer"}
  >
    <div className="flex items-center gap-3">
      <div className="text-primary-70">{icon}</div>
      <div>
        <p className="text-xs font-bold text-black dark:text-white">{label}</p>
        {subLabel ? (
          <p className="text-[10px] text-gray-20 dark:text-secondary-90">
            {subLabel}
          </p>
        ) : null}
      </div>
    </div>
    <ChevronRight className="w-4 h-4 text-gray-30 group-hover:translate-x-0.5 transition-transform" />
  </Link>
)
