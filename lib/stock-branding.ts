const COMPANY_LOGO_DOMAINS: Record<string, string> = {
  DPRI: "dangote.com",
};

export function getCompanyLogoUrl(ticker: string): string | undefined {
  if (/^(GNT|GNTB)$/i.test(ticker.trim())) {
    return "https://res.cloudinary.com/djalafcj9/image/upload/v1620944606/get%20equity/favicon_intftr.ico";
  }
  const domain = COMPANY_LOGO_DOMAINS[ticker.trim().toUpperCase()];

  return domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    : undefined;
}
