import type { CompanyNewsArticle } from "./company-news";

export type NewsCompanyFact = {
  value: string;
  source: string;
  url: string;
  publishedAt: string;
};
export type NewsCompanyFacts = Partial<
  Record<"ceo" | "headquarters" | "founded" | "employees", NewsCompanyFact>
>;

/** Only explicit company-subject statements; never infer facts from unrelated headlines. */
export function extractCompanyNewsFacts(
  articles: CompanyNewsArticle[],
  name: string,
  symbol: string,
): NewsCompanyFacts {
  const aliases =
    symbol === "DJT"
      ? [
          "Trump Media & Technology Group",
          "Trump Media and Technology Group",
          "Trump Media",
        ]
      : symbol === "DPRI"
        ? ["Dangote Petroleum Refinery", "Dangote Refinery"]
        : [name.replace(/\s+Inc\.?$/i, "")];
  const subject = aliases
    .map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const person = "([A-Z][a-z]+(?: [A-Z][a-z]+){1,3})";
  const patterns = {
    ceo: `(?:${subject}) (?:appoints|names) ${person} (?:as |its )?(?:CEO|chief executive)`,
    headquarters: `(?:${subject}) (?:is |has its )?headquartered in ([A-Z][a-z]+(?:[ ,]+[A-Z][a-z]+){0,3})`,
    founded: `(?:${subject}) (?:was |is )?(?:founded|established) in ((?:18|19|20)\\d{2})`,
    employees: `(?:${subject}) (?:has|employs) ([\\d,]+) (?:employees|people|workers)`,
  };
  const facts: NewsCompanyFacts = {};
  const sorted = [...articles].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );
  for (const article of sorted) {
    const text = `${article.title}. ${article.summary || ""}`;
    for (const key of Object.keys(patterns) as Array<keyof typeof patterns>) {
      if (facts[key]) continue;
      const age = Date.now() - Date.parse(article.publishedAt);
      if (
        (key === "ceo" || key === "employees") &&
        (!Number.isFinite(age) || age < 0 || age > 180 * 86400000)
      )
        continue;
      const match = text.match(new RegExp(patterns[key]));
      if (!match) continue;
      facts[key] = {
        value: match[1],
        source: article.source,
        url: article.url,
        publishedAt: article.publishedAt,
      };
    }
  }
  return facts;
}
