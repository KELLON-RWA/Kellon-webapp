type Statement = {
  rank?: string;
  mainsnak?: { datavalue?: { value?: unknown } };
  qualifiers?: Record<string, Array<{ datavalue?: { value?: unknown } }>>;
};
export type WikidataEntity = {
  id: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  aliases?: Record<string, Array<{ value: string }>>;
  claims?: Record<string, Statement[]>;
};
export type WikidataCompanyProfile = {
  name: string;
  description?: string;
  website?: string;
  ceo?: string;
  headquarters?: string;
  founded?: string;
  employees?: string;
  employeesAsOf?: string;
  industry?: string;
  source: "Wikidata";
  sourceUrl: string;
};

export const COMPANY_ENTITY_IDS: Record<string, string> = {
  AAPL: "Q312",
  AMZN: "Q3884",
  GOOGL: "Q20800404",
  META: "Q380",
  MSFT: "Q2283",
  NFLX: "Q907311",
  DJT: "Q109030760",
  DPRI: "Q60748485",
  ARM: "Q296782",
  AVGO: "Q790060",
  BABA: "Q1359568",
  BE: "Q29526078",
  COIN: "Q16972754",
  GME: "Q202210",
  HOOD: "Q18155123",
  INTC: "Q248",
  KO: "Q3295867",
  LITE: "Q30272341",
  MRNA: "Q17081612",
  MRVL: "Q1347782",
  MSTR: "Q1192211",
  NOK: "Q1418",
  NVDA: "Q182477",
  SNDK: "Q260833",
  SKHY: "Q370719",
  SPCX: "Q193701",
  TSLA: "Q478214",
  TSM: "Q713418",
  CRCL: "Q17007851",
  CRWV: "Q121875386",
  FLNC: "Q131886718",
};

const value = (statement: Statement) => statement.mainsnak?.datavalue?.value;
const time = (input: unknown): string => {
  if (!input || typeof input !== "object") return "";
  const raw = (input as { time?: string }).time;
  return typeof raw === "string" ? raw.replace(/^\+/, "").slice(0, 10) : "";
};
function dateQualifier(statement: Statement, property: string) {
  return time(statement.qualifiers?.[property]?.[0]?.datavalue?.value);
}
function statements(entity: WikidataEntity, property: string) {
  const today = new Date().toISOString().slice(0, 10);
  const eligible = (entity.claims?.[property] || []).filter(
    (s) =>
      s.rank !== "deprecated" &&
      (!dateQualifier(s, "P582") || dateQualifier(s, "P582") > today) &&
      (!dateQualifier(s, "P580") || dateQualifier(s, "P580") <= today),
  );
  return eligible.sort(
    (a, b) =>
      Number(b.rank === "preferred") - Number(a.rank === "preferred") ||
      dateQualifier(b, "P585").localeCompare(dateQualifier(a, "P585")),
  );
}
export function relatedCompanyEntityIds(entity: WikidataEntity): string[] {
  return [
    ...new Set(
      ["P169", "P159", "P452", "P131", "P17"]
        .flatMap((property) =>
          statements(entity, property).map((s) => {
            const item = value(s) as { id?: string } | undefined;
            return item?.id || "";
          }),
        )
        .filter((id) => /^Q\d+$/.test(id)),
    ),
  ].slice(0, 20);
}
export function matchesCompanyTicker(entity: WikidataEntity, ticker: string) {
  const expected = ticker === "SKHY" ? "000660" : ticker;
  const direct = statements(entity, "P249").map(value);
  const exchangeTickers = statements(entity, "P414").flatMap((statement) =>
    (statement.qualifiers?.P249 || []).map((snak) => snak.datavalue?.value),
  );
  return [...direct, ...exchangeTickers].some(
    (symbol) =>
      typeof symbol === "string" && symbol.trim().toUpperCase() === expected,
  );
}
export function normalizeWikidataCompany(
  entity: WikidataEntity,
  related: Record<string, WikidataEntity>,
): WikidataCompanyProfile {
  const labels = (property: string) =>
    [
      ...new Set(
        statements(entity, property)
          .map((s) => {
            const id = (value(s) as { id?: string } | undefined)?.id;
            return id
              ? related[id]?.labels?.en?.value ||
                  related[id]?.labels?.mul?.value
              : undefined;
          })
          .filter(Boolean),
      ),
    ].join(" & ") || undefined;
  const headquarters = labels("P159");
  const hqId = (
    value(statements(entity, "P159")[0] || {}) as { id?: string } | undefined
  )?.id;
  const location = hqId ? related[hqId] : undefined;
  const regionNames = location
    ? ["P131", "P17"].flatMap((property) =>
        statements(location, property)
          .map((s) => {
            const id = (value(s) as { id?: string } | undefined)?.id;
            return id
              ? related[id]?.labels?.en?.value ||
                  related[id]?.labels?.mul?.value
              : undefined;
          })
          .filter(Boolean),
      )
    : [];
  const employeeStatement = statements(entity, "P1128")[0];
  const amount = employeeStatement
    ? Number(
        (value(employeeStatement) as { amount?: string } | undefined)?.amount,
      )
    : NaN;
  const websites = statements(entity, "P856").flatMap((s) => {
    const website = value(s);
    try {
      if (typeof website !== "string") return [];
      const url = new URL(website);
      return ["http:", "https:"].includes(url.protocol) ? [url] : [];
    } catch {
      return [];
    }
  });
  // Prefer a global homepage to a country-specific subpage when both are listed.
  const safeWebsite = websites.sort(
    (a, b) => a.pathname.length - b.pathname.length,
  )[0]?.href;
  return {
    name: entity.labels?.en?.value || entity.labels?.mul?.value || entity.id,
    description: entity.descriptions?.en?.value,
    website: safeWebsite,
    ceo: labels("P169"),
    headquarters: headquarters
      ? [...new Set([headquarters, ...regionNames])].join(", ")
      : undefined,
    founded:
      time(value(statements(entity, "P571")[0] || {})).slice(0, 4) || undefined,
    employees:
      Number.isFinite(amount) && amount >= 0
        ? new Intl.NumberFormat("en-US").format(amount)
        : undefined,
    employeesAsOf: employeeStatement
      ? dateQualifier(employeeStatement, "P585") || undefined
      : undefined,
    industry: labels("P452"),
    source: "Wikidata",
    sourceUrl: `https://www.wikidata.org/wiki/${entity.id}`,
  };
}
