"use server";

import { createConfig, ChainId } from "@lifi/sdk";

function getRequiredEnv(name: string, varValue: string | undefined): string {
  if (!varValue) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return varValue;
}

export async function initLifiConfig() {
  // Load API / RPC keys from environment (server-only). Only the LI.FI API key is required:
  // the RPC provider keys are optional optimisations, and a missing one must not take the whole
  // app down at build/prerender time. Chains without a configured provider key fall back to
  // LI.FI's default public RPCs.
  const lifiKey = getRequiredEnv("LIFI_API_KEY", process.env.LIFI_API_KEY);
  const ankrKey = process.env.ANKR_RPC_KEY;
  const alchemyKey = process.env.ALCHEMY_RPC_KEY;
  const infuraKey = process.env.INFURA_RPC_KEY;
  const config = createConfig({
    integrator: "Kellon",
    apiKey: lifiKey,
    preloadChains: false,
    rpcUrls: {
      ...(ankrKey
        ? {
            [ChainId.ARB]: [`https://rpc.ankr.com/arbitrum/${ankrKey}`],
            [ChainId.BSC]: [`https://rpc.ankr.com/bsc/${ankrKey}`],
            [ChainId.ETH]: [`https://rpc.ankr.com/eth/${ankrKey}`],
            [ChainId.AVA]: [`https://rpc.ankr.com/avalanche-c/${ankrKey}`],
            [ChainId.BAS]: [`https://rpc.ankr.com/base/${ankrKey}`],
            [ChainId.BLS]: [`https://rpc.ankr.com/blast/${ankrKey}`],
            [ChainId.POL]: [`https://rpc.ankr.com/polygon/${ankrKey}`],
            [ChainId.ERA]: [`https://rpc.ankr.com/zksync_era/${ankrKey}`],
            [ChainId.PZE]: [`https://rpc.ankr.com/polygon_zkevm/${ankrKey}`],
            [ChainId.DAI]: [`https://rpc.ankr.com/gnosis/${ankrKey}`],
            [ChainId.MOO]: [`https://rpc.ankr.com/moonbeam/${ankrKey}`],
            [ChainId.FLR]: [`https://rpc.ankr.com/flare/${ankrKey}`],
            [ChainId.GRA]: [`https://rpc.ankr.com/gravity/${ankrKey}`],
            [ChainId.TAI]: [`https://rpc.ankr.com/taiko/${ankrKey}`],
            [ChainId.SWL]: [`https://rpc.ankr.com/swell/${ankrKey}`],
            [ChainId.CRN]: [`https://rpc.ankr.com/corn_maizenet/${ankrKey}`],
            [ChainId.CEL]: [`https://rpc.ankr.com/celo/${ankrKey}`],
            [ChainId.ETL]: [`https://rpc.ankr.com/etherlink_mainnet/${ankrKey}`],
            [ChainId.XDC]: [`https://rpc.ankr.com/xdc/${ankrKey}`],
            [ChainId.MNT]: [`https://rpc.ankr.com/mantle_sepolia/${ankrKey}`],
            [ChainId.KAI]: [`https://rpc.ankr.com/kaia/${ankrKey}`],
          }
        : {}),
      ...(alchemyKey
        ? {
            [ChainId.ABS]: [
              `https://abstract-mainnet.g.alchemy.com/v2/${alchemyKey}`,
            ],
            [ChainId.SCL]: [
              `https://scroll-mainnet.g.alchemy.com/v2/${alchemyKey}`,
            ],
            [ChainId.HYP]: [
              `https://hyperliquid-mainnet.g.alchemy.com/v2/${alchemyKey}`,
            ],
            [ChainId.OPB]: [
              `https://opbnb-mainnet.g.alchemy.com/v2/${alchemyKey}`,
            ],
            [ChainId.SOL]: [
              `https://solana-mainnet.g.alchemy.com/v2/${alchemyKey}`,
            ],
          }
        : {}),
      ...(infuraKey
        ? {
            [ChainId.OPT]: [
              `https://optimism-mainnet.infura.io/v3/${infuraKey}`,
            ],
            [ChainId.UNI]: [
              `https://unichain-mainnet.infura.io/v3/${infuraKey}`,
            ],
            [ChainId.SEI]: [`https://sei-mainnet.infura.io/v3/${infuraKey}`],
          }
        : {}),
      [ChainId.APE]: ["https://apechain.drpc.org"],
      [ChainId.LNA]: ["https://linea.drpc.org"],
      [ChainId.FTM]: ["https://1rpc.io/ftm"],
      [ChainId.MOR]: ["https://moonriver.drpc.org"],
      [ChainId.FUS]: ["https://fuse.drpc.org"],
      [ChainId.BOB]: ["https://boba-eth.drpc.org"],
      [ChainId.MOD]: ["https://mode.drpc.org"],
      [ChainId.MAM]: ["https://metis.drpc.org"],
      [ChainId.LSK]: ["https://lisk.drpc.org"],
      [ChainId.AUR]: ["https://aurora.drpc.org"],
      [ChainId.IMX]: ["https://immutable-zkevm.drpc.org"],
      [ChainId.SON]: ["https://sonic.drpc.org"],
      [ChainId.VAN]: ["https://rpc.vana.org"],
      [ChainId.SOE]: ["https://soneium.drpc.org"],
      [ChainId.LNS]: ["https://lens.drpc.org"],
      [ChainId.CRO]: ["https://cronos-evm-rpc.publicnode.com"],
      [ChainId.FRA]: ["https://fraxtal.drpc.org"],
      [ChainId.RSK]: ["https://public-node.rsk.co"],
      [ChainId.WCC]: ["https://worldchain.drpc.org"],
      [ChainId.SUP]: ["https://rpc.superposition.so"],
      [ChainId.INK]: ["https://ink.drpc.org"],
      [ChainId.BOC]: ["https://bob.drpc.org"],
      [ChainId.KAT]: ["https://rpc.katana.network"],
      [ChainId.BER]: ["https://rpc.berachain-apis.com"],
      [ChainId.PLU]: ["https://rpc.plume.org"],
    },
    routeOptions: {
      slippage: 0.005,
      order: "CHEAPEST",
      allowSwitchChain: true,
      fee: 0.002,
      maxPriceImpact: 0.1,
    },
  });
  return config;
}
