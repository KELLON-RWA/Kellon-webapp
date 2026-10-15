const COMPANY_LOGO_DOMAINS: Record<string, string> = {
  AAPL: "apple.com",
  ARM: "arm.com",
  AMZN: "amazon.com",
  AVGO: "broadcom.com",
  BABA: "alibaba.com",
  BE: "bloomenergy.com",
  COIN: "coinbase.com",
  CRCL: "circle.com",
  CRWV: "coreweave.com",
  DJT: "tmtgcorp.com",
  FLNC: "fluenceenergy.com",
  GME: "gamestop.com",
  GOOGL: "google.com",
  HOOD: "robinhood.com",
  INTC: "intel.com",
  KO: "coca-colacompany.com",
  LITE: "lumentum.com",
  META: "meta.com",
  MRNA: "modernatx.com",
  MRVL: "marvell.com",
  MSFT: "microsoft.com",
  MSTR: "strategy.com",
  NFLX: "netflix.com",
  NOK: "nokia.com",
  NVDA: "nvidia.com",
  QQQ: "invesco.com",
  SNDK: "sandisk.com",
  SKHY: "skhynix.com",
  SOXL: "direxion.com",
  SOXS: "direxion.com",
  SPCX: "spacex.com",
  SPY: "ssga.com",
  TQQQ: "proshares.com",
  TSLA: "tesla.com",
  TSM: "tsmc.com",
};

export function getCompanyLogoUrl(ticker: string): string | undefined {
  if (ticker.trim().toUpperCase() === "DPRI") {
    return "/dangote-refinery-logo.png";
  }
  if (/^(GNT|GNTB)$/i.test(ticker.trim())) {
    return "https://res.cloudinary.com/djalafcj9/image/upload/v1620944606/get%20equity/favicon_intftr.ico";
  }
  const domain = COMPANY_LOGO_DOMAINS[ticker.trim().toUpperCase()];

  return domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    : undefined;
}
