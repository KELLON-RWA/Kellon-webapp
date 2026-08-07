import { Chain as ViemChain } from "viem"

/**
 * 1. EXTENDED TYPES
 * We extend the Viem Chain type to include our custom app logic (Stellar support,
 * token addresses, and Paymaster configurations).
 */
export interface ChainConfig extends ViemChain {
  type: "evm" | "stellar"
  usdcAddress?: string
  usdtAddress?: string
  primaryToken?: "USDC" | "USDT"
  paymaster?: {
    enabled: boolean
    paymasterUrl?: string
    bundlerUrl?: string
    coinbasePaymaster?: boolean
    circlePaymaster?: boolean
    pimlicoPaymaster?: boolean
    stellarSponsorship?: boolean
  }
}

export type SupportedChainKeys = "stellar" | "celo" | "polygon" | "base" | "bnb"

/**
 * 2. MAINNET CONFIGURATION
 */
export const MAINNET_CHAINS: Record<SupportedChainKeys, ChainConfig> = {
  stellar: {
    id: 1, // Placeholder for non-EVM compatibility
    name: "Stellar",
    nativeCurrency: { name: "Lumen", symbol: "XLM", decimals: 7 },
    rpcUrls: {
      default: { http: ["https://horizon.stellar.org"] },
      public: { http: ["https://horizon.stellar.org"] },
    },
    blockExplorers: {
      default: {
        name: "StellarExpert",
        url: "https://stellar.expert/explorer/public",
      },
    },
    type: "stellar",
    usdcAddress: "GA5ZSEJYB37JRC5AVCIAZDL2Y3432PCCPCH67M26RWNQX3KDHBN74RSH",
    usdtAddress: "GCQTGZQQ5G4DGSUBCG7N6SJW7GGBRVIWCK5JRLX7CW5C6BSVBSBX5NUV",
    primaryToken: "USDC",
    paymaster: { enabled: true, stellarSponsorship: true },
  },
  base: {
    id: 8453,
    name: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://mainnet.base.org"] },
      public: { http: ["https://mainnet.base.org"] },
    },
    blockExplorers: {
      default: { name: "BaseScan", url: "https://basescan.org" },
    },
    type: "evm",
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    usdtAddress: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    primaryToken: "USDC",
    paymaster: {
      enabled: true,
      circlePaymaster: true,
      paymasterUrl: "https://api.circle.com/paymaster/v1/base/rpc",
      bundlerUrl: "https://api.circle.com/bundler/v1/base/rpc",
    },
  },
  polygon: {
    id: 137,
    name: "Polygon",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://polygon-rpc.com"] },
      public: { http: ["https://polygon.publicnode.com"] },
    },
    blockExplorers: {
      default: { name: "PolygonScan", url: "https://polygonscan.com" },
    },
    type: "evm",
    usdcAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    usdtAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    primaryToken: "USDC",
    paymaster: { enabled: true, circlePaymaster: true },
  },
  celo: {
    id: 42220,
    name: "Celo",
    nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://forno.celo.org"] },
      public: { http: ["https://rpc.ankr.com/celo"] },
    },
    blockExplorers: {
      default: { name: "CeloScan", url: "https://celoscan.io" },
    },
    type: "evm",
    usdcAddress: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    usdtAddress: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    primaryToken: "USDT",
    paymaster: { enabled: true, pimlicoPaymaster: true },
  },
  bnb: {
    id: 56,
    name: "BNB",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://bsc-dataseed.binance.org"] },
      public: { http: ["https://bsc-dataseed.binance.org"] },
    },
    blockExplorers: {
      default: { name: "BscScan", url: "https://bscscan.com" },
    },
    type: "evm",
    usdcAddress: "0x8AC76a51cc950d9822D68b83E1Ad6dF2C52deB",
    usdtAddress: "0x55d398326f99059fF775485246999027B3197955",
    primaryToken: "USDT",
    paymaster: { enabled: true, pimlicoPaymaster: true },
  },
}

/**
 * 3. TESTNET CONFIGURATION
 */
export const TESTNET_CHAINS: Record<SupportedChainKeys, ChainConfig> = {
  stellar: {
    ...MAINNET_CHAINS.stellar,
    id: 2,
    name: "Stellar Testnet",
    rpcUrls: {
      default: { http: ["https://horizon-testnet.stellar.org"] },
      public: { http: ["https://horizon-testnet.stellar.org"] },
    },
    usdcAddress: "GAHPYWLK6YRN7CVYZOO4H3VDRZ7PVF5UJGLZCSPAEIKJE2XSWF5LAGER",
  },
  base: {
    ...MAINNET_CHAINS.base,
    id: 84532,
    name: "Base Sepolia",
    rpcUrls: {
      default: { http: ["https://sepolia.base.org"] },
      public: { http: ["https://sepolia.base.org"] },
    },
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
  polygon: {
    ...MAINNET_CHAINS.polygon,
    id: 80002,
    name: "Polygon Amoy",
    rpcUrls: {
      default: { http: ["https://rpc-amoy.polygon.technology"] },
      public: { http: ["https://rpc-amoy.polygon.technology"] },
    },
    usdcAddress: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
  },
  celo: {
    ...MAINNET_CHAINS.celo,
    id: 11142220,
    name: "Celo Sepolia",
    rpcUrls: {
      default: { http: ["https://forno.celo-sepolia.celo-testnet.org"] },
      public: { http: ["https://forno.celo-sepolia.celo-testnet.org"] },
    },
    usdcAddress: "0x2F25de78d37f30080605c6d750f6AD94895786Cc",
  },
  bnb: {
    ...MAINNET_CHAINS.bnb,
    id: 97,
    name: "BSC Testnet",
    rpcUrls: {
      default: { http: ["https://data-seed-prebsc-1-s1.binance.org:8545"] },
      public: { http: ["https://data-seed-prebsc-1-s1.binance.org:8545"] },
    },
    usdcAddress: "0x64544969ed7EBf5f083679233325356EbE738930",
  },
}

const CHAIN_LABELS: Record<string, string> = {
  stellar: "Stellar Network",
  base: "Base Network",
  bnb: "BNB Smart Chain Network",
  celo: "Celo Network",
  polygon: "Polygon Network",
}



/**
 * 4. UI HELPERS
 */
export const getChainIcon = (symbol: string) =>
  `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`

export const CHAIN_UI_DATA: Record<
  SupportedChainKeys,
  { color: string; benefits: string[] }
> = {
  stellar: {
    color: "#000000",
    benefits: ["Free USDC transfers", "Instant finality"],
  },
  base: {
    color: "#0052FF",
    benefits: ["Circle Paymaster", "Coinbase Integrated"],
  },
  polygon: {
    color: "#8247E5",
    benefits: ["Fast scaling", "Massive Ecosystem"],
  },
  celo: { color: "#35D07F", benefits: ["Mobile-first", "Eco-friendly"] },
  bnb: { color: "#F3BA2F", benefits: ["High performance", "Low fees"] },
}

/**
 * 5. FUNCTIONAL HELPERS
 * Uses NEXT_PUBLIC_NETWORK_MODE environment variable to toggle between networks.
 */
const IS_TESTNET = process.env.NEXT_PUBLIC_NETWORK_MODE === "testnet"

export const getActiveChains = () =>
  IS_TESTNET ? TESTNET_CHAINS : MAINNET_CHAINS

export const getChainById = (chainId: number | string) =>
  Object.values(getActiveChains()).find(
    (c) => c.id === chainId || c.id.toString() === chainId.toString(),
  )

  // Helper to get networks that support a specific token
export const getSupportedChainsForToken = (tokenSymbol: "USDC" | "USDT") => {
  const chains = getActiveChains();
  const key = tokenSymbol.toLowerCase() === "usdc" ? "usdcAddress" : "usdtAddress";
  
  return Object.values(chains).filter((chain) => !!chain[key]);
};


export function getChainLabel(chain?: string | null): string {
  if (!chain) return "Network"

  return CHAIN_LABELS[chain.toLowerCase()] || chain
}


export const getEVMChains = () =>
  Object.values(getActiveChains()).filter((c) => c.type === "evm")

export default MAINNET_CHAINS
