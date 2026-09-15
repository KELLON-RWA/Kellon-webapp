import React, { FC } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface ChainIconProps {
  name: string
  size?: number
  className?: string
}

/**
 * Provides original branding for supported blockchains using standard Web SVGs and CDN assets
 */
const ChainIcon: FC<ChainIconProps> = ({ name, size = 32, className }) => {
  if (!name || typeof name !== "string") return null

  // Normalize: Lowercase and remove ALL spaces
  // "BNB Chain" -> "bnbchain"
  const normalizedName = name.toLowerCase().replace(/\s+/g, "")

  const iconUrl = (symbol: string) =>
    `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol}.png`
  const solanaLogomarkUrl =
    "https://raw.githubusercontent.com/solana-foundation/solana-com/main/apps/docs/public/img/logomark-color.svg"

  switch (normalizedName) {
    case "base":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          className={className}
        >
          <circle cx="50" cy="50" r="50" fill="#0052FF" />
          <circle cx="50" cy="50" r="25" stroke="white" strokeWidth="15" />
        </svg>
      )

    case "celo":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          className={className}
        >
          <circle cx="38" cy="50" r="32" stroke="#35D07F" strokeWidth="8" />
          <circle cx="62" cy="50" r="32" stroke="#FBCC5C" strokeWidth="8" />
        </svg>
      )

    case "solana":
      return (
        <div
          className={cn("relative shrink-0", className)}
          style={{ width: size, height: size }}
        >
          <Image
            src={solanaLogomarkUrl}
            alt="Solana"
            fill
            sizes={`${size}px`}
            unoptimized
            className="object-contain"
          />
        </div>
      )

    // Now these will catch "BNB Chain", "bnbchain", or "BNB"
    case "polygon":
    case "bnb":
    case "bnbchain":
    case "stellar":
      const symbolMap: Record<string, string> = {
        polygon: "matic",
        bnb: "bnb",
        bnbchain: "bnb",
        stellar: "xlm",
      }

      return (
        <div
          className={cn("relative overflow-hidden rounded-full", className)}
          style={{ width: size, height: size }}
        >
          <Image
            src={iconUrl(symbolMap[normalizedName])}
            alt={name}
            fill
            className="object-contain"
          />
        </div>
      )

    default:
      return (
        <div
          className={cn("bg-gray-200 rounded-full", className)}
          style={{ width: size, height: size }}
        />
      )
  }
}

export default ChainIcon
