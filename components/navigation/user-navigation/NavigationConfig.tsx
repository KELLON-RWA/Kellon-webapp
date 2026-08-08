import {
  Bell,
  Share2,
  MessageSquare,
  Shield,
  FileText,
  AlertCircle,
  Info,
} from "lucide-react"

type Handlers = {
  openModal: (modal: string) => void
  handleShare: () => void
}

export const MENU_SECTIONS = (handlers: Handlers) => [
  {
    title: "Security Center",
    items: [
      {
        icon: <Shield className="w-4 h-4" />,
        label: "Security & Backup",
        subLabel: "Verification, recovery and trusted devices",
        href: "/settings/security",
      },
    ],
  },
  {
    title: "Preferences",
    items: [
      {
        icon: <Bell className="w-4 h-4" />,
        label: "Push Notifications",
        action: () => handlers.openModal("notifications"),
      },
    ],
  },
  {
    title: "Support & Community",
    items: [
      {
        icon: <Share2 className="w-4 h-4" />,
        label: "Share Kellon",
        action: handlers.handleShare,
      },
      {
        icon: <MessageSquare className="w-4 h-4" />,
        label: "Help & Support",
        action: () => handlers.openModal("help & support"),
      },
    ],
  },
  {
    title: "Legal & Information",
    isLink: true,
    items: [
      {
        icon: <Shield className="w-4 h-4" />,
        label: "Privacy Policy",
        href: "https://www.kellon.xyz/privacy-policy",
      },
      {
        icon: <FileText className="w-4 h-4" />,
        label: "Terms of Use",
        href: "https://www.kellon.xyz/terms-of-use",
      },
      {
        icon: <AlertCircle className="w-4 h-4" />,
        label: "Disclaimer",
        href: "https://www.kellon.xyz/disclaimer",
      },
      {
        icon: <Info className="w-4 h-4" />,
        label: "About Kellon",
        href: "https://www.kellon.xyz/#about",
      },
    ],
  },
]
