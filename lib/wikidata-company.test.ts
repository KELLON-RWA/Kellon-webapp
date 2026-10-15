import { describe, expect, it } from "vitest";
import {
  matchesCompanyTicker,
  normalizeWikidataCompany,
  type WikidataEntity,
} from "./wikidata-company";

const statement = (value: unknown, extra = {}) => ({
  mainsnak: { datavalue: { value } },
  ...extra,
});
const date = (year: number) => [
  { datavalue: { value: { time: `+${year}-01-01T00:00:00Z` } } },
];

describe("Wikidata company profiles", () => {
  it("resolves company facts, excludes former executives and dates employee counts", () => {
    const entity: WikidataEntity = {
      id: "Q312",
      labels: { en: { value: "Apple Inc." } },
      claims: {
        P169: [
          statement({ id: "Qold" }, { qualifiers: { P582: date(2011) } }),
          statement({ id: "Qcurrent" }),
        ],
        P159: [statement({ id: "Qcity" })],
        P571: [statement({ time: "+1976-04-01T00:00:00Z" })],
        P1128: [
          statement(
            { amount: "+161000" },
            { qualifiers: { P585: date(2023) } },
          ),
          statement(
            { amount: "+164000" },
            { qualifiers: { P585: date(2025) } },
          ),
        ],
        P856: [statement("https://apple.com")],
      },
    };
    expect(
      normalizeWikidataCompany(entity, {
        Qcurrent: { id: "Qcurrent", labels: { en: { value: "Tim Cook" } } },
        Qcity: { id: "Qcity", labels: { en: { value: "Cupertino" } } },
      }),
    ).toMatchObject({
      ceo: "Tim Cook",
      headquarters: "Cupertino",
      founded: "1976",
      employees: "164,000",
      employeesAsOf: "2025-01-01",
      sourceUrl: "https://www.wikidata.org/wiki/Q312",
    });
  });
  it("rejects unsafe website URLs and preserves missing facts", () => {
    const profile = normalizeWikidataCompany(
      { id: "Q1", claims: { P856: [statement("javascript:alert(1)")] } },
      {},
    );
    expect(profile.website).toBeUndefined();
    expect(profile.ceo).toBeUndefined();
    expect(profile.employees).toBeUndefined();
  });
  it("requires a matching ticker for unpinned company search results", () => {
    expect(
      matchesCompanyTicker(
        { id: "Q1", claims: { P249: [statement("NVDA")] } },
        "NVDA",
      ),
    ).toBe(true);
    expect(
      matchesCompanyTicker(
        { id: "Q1", claims: { P249: [statement("OTHER")] } },
        "NVDA",
      ),
    ).toBe(false);
  });

  it("resolves exchange-qualified tickers and Korean stock aliases", () => {
    const company: WikidataEntity = {
      id: "Q1",
      claims: {
        P414: [
          statement(
            { id: "Qexchange" },
            { qualifiers: { P249: [{ datavalue: { value: "NVDA" } }] } },
          ),
        ],
      },
    };
    expect(matchesCompanyTicker(company, "NVDA")).toBe(true);
    expect(matchesCompanyTicker(company, "OTHER")).toBe(false);
    company.claims!.P414[0].qualifiers!.P249[0].datavalue!.value = "000660";
    expect(matchesCompanyTicker(company, "SKHY")).toBe(true);
  });
  it("ignores deprecated and future appointments", () => {
    expect(
      normalizeWikidataCompany(
        {
          id: "Q1",
          claims: {
            P169: [
              statement({ id: "Q2" }, { rank: "deprecated" }),
              statement({ id: "Q3" }, { qualifiers: { P580: date(2100) } }),
            ],
          },
        },
        {},
      ).ceo,
    ).toBeUndefined();
  });
});
