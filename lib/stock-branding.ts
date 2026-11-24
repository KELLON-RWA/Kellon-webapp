const COMPANY_LOGO_DOMAINS: Record<string, string> = {
  AAPL: "apple.com",
  ABNB: "airbnb.com",
  AGG: "ishares.com",
  AMC: "amctheatres.com",
  AMZN: "amazon.com",
  ARM: "arm.com",
  AVGO: "broadcom.com",
  BABA: "alibaba.com",
  BE: "bloomenergy.com",
  BIL: "ssga.com",
  BNC: "ceaindustries.com",
  BND: "vanguard.com",
  COIN: "coinbase.com",
  CRCL: "circle.com",
  CRM: "salesforce.com",
  CRWV: "coreweave.com",
  DIS: "disney.com",
  DJT: "tmtgcorp.com",
  FLNC: "fluenceenergy.com",
  FXI: "ishares.com",
  GLD: "spdrgoldshares.com",
  GME: "gamestop.com",
  GOOGL: "google.com",
  HOOD: "robinhood.com",
  IAU: "ishares.com",
  IEF: "ishares.com",
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
  SGOV: "ishares.com",
  SHY: "ishares.com",
  SKHY: "skhynix.com",
  SLV: "ishares.com",
  SNDK: "sandisk.com",
  SOXL: "direxion.com",
  SOXS: "direxion.com",
  SPCX: "spacex.com",
  SPY: "ssga.com",
  TLT: "ishares.com",
  TQQQ: "proshares.com",
  TSLA: "tesla.com",
  TSM: "tsmc.com",
  UBER: "uber.com",
};

export function getCompanyLogoUrl(ticker: string): string | undefined {
  const normalized = ticker.trim().toUpperCase();
  if (normalized === "DPRI") {
    return "/dangote-refinery-logo.png";
  }
  if (normalized === "AMD") {
    return "/amd-logo.svg";
  }
  if (/^(GNT|GNTB)$/i.test(ticker.trim())) {
    return "https://res.cloudinary.com/djalafcj9/image/upload/v1620944606/get%20equity/favicon_intftr.ico";
  }
  const domain = COMPANY_LOGO_DOMAINS[normalized];

  return domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    : undefined;
}
