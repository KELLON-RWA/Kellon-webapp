import { ReactNode } from "react"

export type ModalType =
  | "stellar key recovery"
  | "trusted devices"
  | "social recovery"
  | "notifications"
  | "help & support"
  | "appearance"
  | null

export interface NavItemProps {
  icon: ReactNode
  label: string
  subLabel?: string
  onClick: () => void
}

export interface LinkItemProps {
  icon: ReactNode
  label: string
  subLabel?: string
  href: string
  onClick?: () => void
}
