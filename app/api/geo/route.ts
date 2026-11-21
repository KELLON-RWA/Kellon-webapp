import { NextResponse, NextRequest } from "next/server"

export const dynamic = "force-dynamic"
export const revalidate = 0

const ISO_ALPHA2_REGEX = /^[A-Z]{2}$/
const PSEUDO_COUNTRY_CODES = new Set(["XX", "T1", "A1", "A2", "O1"])
const DEFAULT_COUNTRY = "NG"

function sanitizeCountryCode(code: string | null | undefined): string | null {
  if (!code) return null
  const trimmed = code.trim().toUpperCase()
  if (ISO_ALPHA2_REGEX.test(trimmed) && !PSEUDO_COUNTRY_CODES.has(trimmed)) {
    return trimmed
  }
  return null
}

function isPrivateOrLocalIp(ip: string): boolean {
  if (!ip) return true
  const clean = ip.trim().toLowerCase()
  if (
    clean === "localhost" ||
    clean === "::1" ||
    clean === "127.0.0.1" ||
    clean.startsWith("10.") ||
    clean.startsWith("192.168.") ||
    clean.startsWith("fc00:") ||
    clean.startsWith("fe80:")
  ) {
    return true
  }
  const match172 = clean.match(/^172\.(\d+)\./)
  if (match172) {
    const secondOctet = parseInt(match172[1], 10)
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true
    }
  }
  return false
}

function extractClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp) return realIp

  return null
}

export async function GET(request: NextRequest) {
  try {
    // 1. Check for standard proxy headers from verified CDN/reverse proxy layers
    let country =
      sanitizeCountryCode(request.headers.get("x-vercel-ip-country")) ||
      sanitizeCountryCode(request.headers.get("cf-ipcountry"))

    // In non-production environments (local dev / testing), allow dev override via x-country-code
    if (!country && process.env.NODE_ENV !== "production") {
      country = sanitizeCountryCode(request.headers.get("x-country-code"))
    }

    if (country) {
      return NextResponse.json(
        { country, country_code: country },
        {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        },
      )
    }

    // 2. Fallback: resolve client's public IP rather than server datacenter IP
    const clientIp = extractClientIp(request)

    if (clientIp && !isPrivateOrLocalIp(clientIp)) {
      const res = await fetch(
        `http://ip-api.com/json/${encodeURIComponent(clientIp)}?fields=status,countryCode`,
        {
          signal: AbortSignal.timeout(2500),
        },
      )

      if (res.ok) {
        const data = await res.json()
        const code = sanitizeCountryCode(data.countryCode)
        if (code) {
          return NextResponse.json(
            { country: code, country_code: code },
            {
              headers: {
                "Cache-Control": "no-store, max-age=0",
              },
            },
          )
        }
      }
    }

    // 3. Safe default fallback
    return NextResponse.json(
      { country: DEFAULT_COUNTRY, country_code: DEFAULT_COUNTRY },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    )
  } catch (error) {
    console.error("Geo detection error:", error)
    return NextResponse.json(
      { country: DEFAULT_COUNTRY, country_code: DEFAULT_COUNTRY },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    )
  }
}
