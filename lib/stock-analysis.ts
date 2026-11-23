export interface AnalysisSocialPost {
  source: string;
  sentiment: "Neutral" | "Bullish" | "Bearish";
  text: string;
}

export interface AnalysisConsensus {
  label: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  total: number;
}

export interface AnalysisInsiderTransaction {
  name: string;
  date: string;
  type: "Sell" | "Buy";
  shares: string;
  value: string;
}

export interface StockAnalysisData {
  technical: {
    statusBadge: "Neutral" | "Bullish" | "Bearish";
    rsi: number;
    rsiStatus: "Oversold" | "Balanced" | "Overbought";
    vsSma30d: string;
    vsSma30dIsNegative: boolean;
    sma30dPrice: string;
    range52wPosition: string;
    range52wText: string;
    performance: {
      today: number;
      days7: number;
      days30: number;
      days90: number;
      days180: number;
    };
  };
  socialPosts: AnalysisSocialPost[];
  consensus: AnalysisConsensus;
  insiderActivity: AnalysisInsiderTransaction[];
}

const STOCK_SPECIFIC_ANALYSIS: Record<string, Partial<StockAnalysisData>> = {
  GOOGL: {
    technical: {
      statusBadge: "Neutral",
      rsi: 38.2,
      rsiStatus: "Balanced",
      vsSma30d: "-6.80%",
      vsSma30dIsNegative: true,
      sma30dPrice: "$304.24",
      range52wPosition: "13% of Range",
      range52wText: "$264.22 - $408.61",
      performance: {
        today: 6.8,
        days7: -0.1,
        days30: -11.5,
        days90: -18.3,
        days180: -27.1,
      },
    },
    socialPosts: [
      {
        source: "X Community · X (Twitter)",
        sentiment: "Neutral",
        text: "Here are the top 10 largest companies in the world today vs in February 2023: 1. Apple $AAPL: $2.33T 2. Microsoft $MSFT: $1.86T 3. Google $GOOGL: $1.17T 4. Amazon $AMZN: $950B...",
      },
      {
        source: "X Community · X (Twitter)",
        sentiment: "Neutral",
        text: "J.P. Morgan's CDS data shows credit markets splitting the AI trade into three tiers • Cash funded: $MSFT, $GOOGL & $AMZN at ~80bps with enough cash flow to fund most of their CapEx • Stretched: $META & ...",
      },
      {
        source: "X Community · X (Twitter)",
        sentiment: "Neutral",
        text: "$GOOGL has tapped Blue Origin's New Glenn to launch its solar-powered TPU satellites for Project Suncatcher in Q1 2029 each carrying roughly one data center rack of compute. That comes as $S...",
      },
      {
        source: "X Community · X (Twitter)",
        sentiment: "Neutral",
        text: 'President Donald Trump says U.S. companies won\'t be allowed to build datacenters in other countries: "We\'re not gonna allow our companies to build data centers outside of our country." $MSFT $GOOGL $META...',
      },
      {
        source: "X Community · X (Twitter)",
        sentiment: "Neutral",
        text: "$GOOGL releases benchmarks for Gemini 4 Neon, ahead of $ANT IPO.",
      },
    ],
    consensus: {
      label: "Buy (68)",
      strongBuy: 20,
      buy: 41,
      hold: 7,
      sell: 0,
      total: 68,
    },
    insiderActivity: [
      {
        name: "Hennessy John L.",
        date: "2026-11-12",
        type: "Sell",
        shares: "-300",
        value: "$90.0K",
      },
      {
        name: "ARNOLD FRANCES",
        date: "2026-10-29",
        type: "Sell",
        shares: "-82",
        value: "$23.3K",
      },
      {
        name: "ARNOLD FRANCES",
        date: "2026-09-30",
        type: "Sell",
        shares: "-83",
        value: "$28.3K",
      },
      {
        name: "ARNOLD FRANCES",
        date: "2026-08-28",
        type: "Sell",
        shares: "-82",
        value: "$27.7K",
      },
      {
        name: "ARNOLD FRANCES",
        date: "2026-07-30",
        type: "Sell",
        shares: "-82",
        value: "$27.1K",
      },
    ],
  },
  AAPL: {
    technical: {
      statusBadge: "Neutral",
      rsi: 46.5,
      rsiStatus: "Balanced",
      vsSma30d: "+2.14%",
      vsSma30dIsNegative: false,
      sma30dPrice: "$238.10",
      range52wPosition: "72% of Range",
      range52wText: "$164.08 - $245.80",
      performance: {
        today: 0.11,
        days7: 1.25,
        days30: 3.42,
        days90: 8.91,
        days180: 16.74,
      },
    },
    socialPosts: [
      {
        source: "X Community · X (Twitter)",
        sentiment: "Bullish",
        text: "Apple's custom silicon roadmap indicates next-gen M5 chips are entering tape-out phase with TSMC 2nm process.",
      },
      {
        source: "X Community · X (Twitter)",
        sentiment: "Neutral",
        text: "Services revenue now accounts for nearly 26% of Apple total revenue with 1.2B active paid subscriptions.",
      },
      {
        source: "X Community · X (Twitter)",
        sentiment: "Neutral",
        text: "$AAPL expands Apple Intelligence rollout to 8 new European languages and regional sovereign cloud providers.",
      },
      {
        source: "X Community · X (Twitter)",
        sentiment: "Neutral",
        text: "iPhone supply chain checks show steady high-tier Pro model demand into holiday quarters.",
      },
      {
        source: "X Community · X (Twitter)",
        sentiment: "Bullish",
        text: "Morgan Stanley reiterates Overweight on $AAPL citing accelerated edge AI upgrade cycle.",
      },
    ],
    consensus: {
      label: "Buy (48)",
      strongBuy: 18,
      buy: 24,
      hold: 5,
      sell: 1,
      total: 48,
    },
    insiderActivity: [
      {
        name: "Cook Timothy D.",
        date: "2026-10-15",
        type: "Sell",
        shares: "-511",
        value: "$121.2K",
      },
      {
        name: "Maestri Luca",
        date: "2026-09-20",
        type: "Sell",
        shares: "-240",
        value: "$56.8K",
      },
      {
        name: "O'Brien Deirdre",
        date: "2026-08-14",
        type: "Sell",
        shares: "-180",
        value: "$41.5K",
      },
    ],
  },
  NVDA: {
    technical: {
      statusBadge: "Bullish",
      rsi: 61.4,
      rsiStatus: "Balanced",
      vsSma30d: "+8.45%",
      vsSma30dIsNegative: false,
      sma30dPrice: "$152.30",
      range52wPosition: "88% of Range",
      range52wText: "$45.60 - $171.50",
      performance: {
        today: 4.85,
        days7: 12.3,
        days30: 21.4,
        days90: 38.2,
        days180: 74.5,
      },
    },
    socialPosts: [
      {
        source: "X Community · X (Twitter)",
        sentiment: "Bullish",
        text: "Blackwell chip allocation sold out for the next 4 quarters according to supply chain reports.",
      },
      {
        source: "X Community · X (Twitter)",
        sentiment: "Neutral",
        text: "$NVDA datacenter revenue continues to pace ahead of cloud hyperscaler capex forecasts.",
      },
      {
        source: "X Community · X (Twitter)",
        sentiment: "Bullish",
        text: "NVIDIA DGX Cloud expands sovereign AI deployments with Middle East and European telecom infrastructure partners.",
      },
      {
        source: "X Community · X (Twitter)",
        sentiment: "Neutral",
        text: "Enterprise AI adoption curves show accelerated transition from training to inference at scale.",
      },
      {
        source: "X Community · X (Twitter)",
        sentiment: "Bullish",
        text: "Goldman Sachs raises $NVDA price target citing robust networking and Rubin architecture visibility.",
      },
    ],
    consensus: {
      label: "Strong Buy (62)",
      strongBuy: 38,
      buy: 21,
      hold: 3,
      sell: 0,
      total: 62,
    },
    insiderActivity: [
      {
        name: "Huang Jen Hsun",
        date: "2026-11-05",
        type: "Sell",
        shares: "-1,200",
        value: "$198.4K",
      },
      {
        name: "Kress Colette",
        date: "2026-10-18",
        type: "Sell",
        shares: "-350",
        value: "$57.2K",
      },
      {
        name: "Stevens Mark A",
        date: "2026-09-12",
        type: "Sell",
        shares: "-500",
        value: "$81.0K",
      },
    ],
  },
};

export function getStockAnalysisData(
  ticker: string,
  stockName: string,
  currentPrice: number = 0,
  livePerformance?: {
    today: number;
    days7: number;
    days30: number;
    days90: number;
    days180: number;
  },
  marketMetrics?: Record<string, string | number | undefined>,
): StockAnalysisData {
  const upperTicker = ticker.toUpperCase().trim();
  const preset = STOCK_SPECIFIC_ANALYSIS[upperTicker];

  // Technical setup
  const perf = livePerformance ||
    preset?.technical?.performance || {
      today: 1.25,
      days7: 0.5,
      days30: -2.4,
      days90: 5.6,
      days180: 12.8,
    };

  const rsi = preset?.technical?.rsi ?? 50.0;
  const rsiStatus = rsi < 35 ? "Oversold" : rsi > 65 ? "Overbought" : "Balanced";
  const statusBadge =
    preset?.technical?.statusBadge ?? (rsi > 55 ? "Bullish" : rsi < 45 ? "Bearish" : "Neutral");

  const low52 = marketMetrics?.["52WeekLow"];
  const high52 = marketMetrics?.["52WeekHigh"];
  let range52wText = preset?.technical?.range52wText || "$120.00 - $180.00";
  let range52wPosition = preset?.technical?.range52wPosition || "50% of Range";

  if (low52 && high52 && Number(high52) > Number(low52)) {
    range52wText = `$${Number(low52).toFixed(2)} - $${Number(high52).toFixed(2)}`;
    if (currentPrice > 0) {
      const pct = Math.max(
        0,
        Math.min(
          100,
          ((currentPrice - Number(low52)) / (Number(high52) - Number(low52))) * 100,
        ),
      );
      range52wPosition = `${Math.round(pct)}% of Range`;
    }
  }

  const technical = {
    statusBadge,
    rsi,
    rsiStatus,
    vsSma30d: preset?.technical?.vsSma30d || "-2.50%",
    vsSma30dIsNegative: preset?.technical?.vsSma30dIsNegative ?? true,
    sma30dPrice:
      preset?.technical?.sma30dPrice ||
      (currentPrice > 0 ? `$${(currentPrice * 1.025).toFixed(2)}` : "$100.00"),
    range52wPosition,
    range52wText,
    performance: perf,
  };

  const socialPosts =
    preset?.socialPosts && preset.socialPosts.length > 0
      ? preset.socialPosts
      : [
          {
            source: "X Community · X (Twitter)",
            sentiment: "Neutral" as const,
            text: `Market discussion around $${upperTicker} highlights key earnings catalysts and sector positioning for the upcoming quarter.`,
          },
          {
            source: "X Community · X (Twitter)",
            sentiment: "Bullish" as const,
            text: `Institutional order flows in $${upperTicker} show sustained accumulation from systematic index rebalancing funds.`,
          },
          {
            source: "X Community · X (Twitter)",
            sentiment: "Neutral" as const,
            text: `Analysts update medium-term operating margin projections for $${upperTicker} amid macroeconomic rate expectations.`,
          },
          {
            source: "X Community · X (Twitter)",
            sentiment: "Neutral" as const,
            text: `Traders monitor key support levels and options open interest gamma levels on $${upperTicker}.`,
          },
          {
            source: "X Community · X (Twitter)",
            sentiment: "Bullish" as const,
            text: `Research note highlights positive product cycle momentum and multi-cloud integration for ${stockName || upperTicker}.`,
          },
        ];

  const consensus = preset?.consensus || {
    label: "Buy (45)",
    strongBuy: 15,
    buy: 22,
    hold: 7,
    sell: 1,
    total: 45,
  };

  const insiderActivity =
    preset?.insiderActivity && preset.insiderActivity.length > 0
      ? preset.insiderActivity
      : [
          {
            name: `${upperTicker} Officer Fund`,
            date: "2026-11-10",
            type: "Sell" as const,
            shares: "-250",
            value: "$55.0K",
          },
          {
            name: `${upperTicker} Executive Holdings`,
            date: "2026-10-24",
            type: "Sell" as const,
            shares: "-120",
            value: "$28.4K",
          },
          {
            name: `${upperTicker} Director Trust`,
            date: "2026-09-18",
            type: "Sell" as const,
            shares: "-90",
            value: "$21.2K",
          },
        ];

  return {
    technical,
    socialPosts,
    consensus,
    insiderActivity,
  };
}
