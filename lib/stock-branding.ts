const COMPANY_LOGO_DOMAINS: Record<string, string> = {
  AAPL: "apple.com",
  ABNB: "airbnb.com",
  AMD: "amd.com",
  AMZN: "amazon.com",
  ARM: "arm.com",
  AVGO: "broadcom.com",
  BABA: "alibaba.com",
  BE: "bloomenergy.com",
  COIN: "coinbase.com",
  CRCL: "circle.com",
  CRM: "salesforce.com",
  CRWV: "coreweave.com",
  DIS: "disney.com",
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
  ORCL: "oracle.com",
  PLTR: "palantir.com",
  PYPL: "paypal.com",
  QCOM: "qualcomm.com",
  QQQ: "invesco.com",
  SKHY: "skhynix.com",
  SNDK: "sandisk.com",
  SOXL: "direxion.com",
  SOXS: "direxion.com",
  SPCX: "spacex.com",
  SPY: "ssga.com",
  TQQQ: "proshares.com",
  TSLA: "tesla.com",
  TSM: "tsmc.com",
  UBER: "uber.com",
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
