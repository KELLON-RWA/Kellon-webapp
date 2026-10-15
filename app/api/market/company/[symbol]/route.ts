import { NextResponse } from "next/server";
import {
  COMPANY_ENTITY_IDS,
  matchesCompanyTicker,
  normalizeWikidataCompany,
  relatedCompanyEntityIds,
  type WikidataEntity,
} from "@/lib/wikidata-company";
import { getCompanyNewsName } from "@/lib/company-news";

export const runtime = "nodejs";
export const revalidate = 86400;

async function requestWikidata(params: Record<string, string>) {
  const response = await fetch(
    `https://www.wikidata.org/w/api.php?${new URLSearchParams({ format: "json", ...params })}`,
    {
      headers: {
        "User-Agent": "KellonCompanyProfiles/1.0 (https://kellon.xyz)",
        Accept: "application/json",
      },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok) throw new Error("Wikidata unavailable");
  const data = await response.json();
  if (data.error) throw new Error("Wikidata unavailable");
  return data;
}
async function entities(
  ids: string[],
): Promise<Record<string, WikidataEntity>> {
  if (!ids.length) return {};
  return (
    (
      await requestWikidata({
        action: "wbgetentities",
        ids: ids.join("|"),
        props: "labels|descriptions|claims",
        languages: "en|mul",
      })
    ).entities || {}
  );
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const symbol = (await params).symbol.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,16}$/.test(symbol))
    return NextResponse.json(
      { message: "Invalid stock symbol" },
      { status: 400 },
    );
  try {
    let entity: WikidataEntity | undefined;
    const pinnedId = COMPANY_ENTITY_IDS[symbol];
    if (pinnedId) entity = (await entities([pinnedId]))[pinnedId];
    else {
      const name = getCompanyNewsName(
        new URL(request.url).searchParams.get("name") || "",
      );
      if (!name || name.length > 160)
        return NextResponse.json({ profile: null });
      const search = await requestWikidata({
        action: "wbsearchentities",
        search: name,
        language: "en",
        limit: "5",
        type: "item",
      });
      const ids = (search.search || [])
        .map((item: { id: string }) => item.id)
        .filter((id: string) => /^Q\d+$/.test(id));
      const matches = Object.values(await entities(ids)).filter((item) =>
        matchesCompanyTicker(item, symbol),
      );
      // Do not guess between similarly named companies or an unverified search hit.
      if (matches.length === 1) entity = matches[0];
    }
    if (!entity?.claims) return NextResponse.json({ profile: null });
    const related = await entities(relatedCompanyEntityIds(entity));
    const headquartersIds = (entity.claims.P159 || [])
      .map(
        (s) =>
          (s.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id,
      )
      .filter(Boolean) as string[];
    const regionIds = headquartersIds
      .flatMap((id) =>
        related[id] ? relatedCompanyEntityIds(related[id]) : [],
      )
      .filter((id) => !related[id]);
    Object.assign(
      related,
      await entities([...new Set(regionIds)].slice(0, 20)),
    );
    return NextResponse.json({
      profile: normalizeWikidataCompany(entity, related),
    });
  } catch {
    return NextResponse.json(
      { message: "Company profile temporarily unavailable" },
      { status: 502 },
    );
  }
}
