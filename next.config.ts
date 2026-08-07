import type { NextConfig } from "next"

const backendApiUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL?.replace(
  /\/$/,
  "",
)

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "flagsapi.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "assets.coingecko.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "static.debank.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "anzen.finance",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "assets.gravity.xyz",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "coin-images.coingecko.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "s2.coinmarketcap.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "etherscan.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "arbiscan.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "strapi.jumper.exchange",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "polygonscan.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "fraction.fyi",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "tokenlist.superfluid.org",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "superfluid-finance.github.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "snowtrace.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.bonsai.meme",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "optimistic.etherscan.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "minerva.digital",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.towns.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "i.imgur.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "basescan.org",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "monerium.app",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "ftmscan.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "github.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "icodrops.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.sei.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "niftyleague.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.prod.website-files.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "img.sonex.so",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "img.reservoir.tools",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "benybadboy.b-cdn.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "hub.berachain.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "pbs.twimg.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.geckoterminal.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "%20",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "linea.build",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "dashboard.m0.org",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "assets.apyx.fi",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "www.centiiv.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "paycrest.io",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "media.licdn.com",
        pathname: "/**",
      },
    ],
  },

  async rewrites() {
    if (!backendApiUrl) return []

    return [
      {
        source: "/api/:path*",
        destination: `${backendApiUrl}/:path*`,
      },
    ]
  },
}

export default nextConfig
