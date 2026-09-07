import { getSearchConsoleConnection } from "@/lib/search-console-auth";

const WEBMASTERS_BASE = "https://www.googleapis.com/webmasters/v3";
const SEARCHCONSOLE_BASE = "https://searchconsole.googleapis.com/v1";

async function scFetch(url: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Search Console API error (${res.status}): ${body.slice(0, 500)}`);
  }
  // sitemaps.submit (PUT) returns an empty body on success.
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

/** Maps a thrown error from any function in this file to an HTTP status + a message
 *  safe to show the seller. A 403 here almost always means the service account hasn't
 *  been added as a user on the Search Console property yet — scFetch's raw Google error
 *  text for that case doesn't contain "não configurado"/"Unverified", so without this it
 *  fell through to a generic "connection failure" 502 instead of the real, fixable cause. */
export function searchConsoleErrorStatus(e: unknown): { status: number; message: string } {
  const message = e instanceof Error ? e.message : "Unknown error";
  if (message.includes("não configurado")) return { status: 401, message };
  if (message.includes("Unverified")) return { status: 401, message };
  if (/Search Console API error \(403\)/.test(message)) {
    return {
      status: 403,
      message:
        "A conta de serviço não tem permissão nessa propriedade do Search Console. Adicione o e-mail dela como usuária em Search Console → Configurações → Usuários e permissões, com acesso completo.",
    };
  }
  return { status: 502, message };
}

export type SiteInfo = { siteUrl: string; permissionLevel: string };

/** Confirms the service account actually has access — permissionLevel comes back
 *  "siteUnverifiedUser" if the email hasn't been added as a Search Console user yet. */
export async function getSiteInfo(): Promise<SiteInfo> {
  const { accessToken, siteUrl } = await getSearchConsoleConnection();
  return scFetch(`${WEBMASTERS_BASE}/sites/${encodeURIComponent(siteUrl)}`, accessToken);
}

export type SearchAnalyticsRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };

export async function querySearchAnalytics(
  startDate: string,
  endDate: string,
  dimensions: ("query" | "page" | "device" | "country")[],
  rowLimit = 25
): Promise<SearchAnalyticsRow[]> {
  const { accessToken, siteUrl } = await getSearchConsoleConnection();
  const data = await scFetch(
    `${WEBMASTERS_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    accessToken,
    { method: "POST", body: JSON.stringify({ startDate, endDate, dimensions, rowLimit }) }
  );
  return data.rows ?? [];
}

export type SitemapInfo = {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending?: boolean;
  isSitemapsIndex?: boolean;
  errors?: number;
  warnings?: number;
  contents?: { type: string; submitted: number; indexed: number }[];
};

export async function listSitemaps(): Promise<SitemapInfo[]> {
  const { accessToken, siteUrl } = await getSearchConsoleConnection();
  const data = await scFetch(`${WEBMASTERS_BASE}/sites/${encodeURIComponent(siteUrl)}/sitemaps`, accessToken);
  return data.sitemap ?? [];
}

/** (Re)submits the sitemap so Search Console re-checks it — same effect as clicking
 *  "Enviar" in the Search Console UI, but from our own admin. */
export async function submitSitemap(sitemapUrl: string): Promise<void> {
  const { accessToken, siteUrl } = await getSearchConsoleConnection();
  await scFetch(
    `${WEBMASTERS_BASE}/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
    accessToken,
    { method: "PUT" }
  );
}

export type UrlInspectionResult = {
  indexStatusResult?: {
    verdict?: string;
    coverageState?: string;
    robotsTxtState?: string;
    indexingState?: string;
    lastCrawlTime?: string;
    pageFetchState?: string;
    googleCanonical?: string;
    userCanonical?: string;
  };
  richResultsResult?: { verdict?: string; detectedItems?: { richResultType?: string }[] };
};

export async function inspectUrl(inspectionUrl: string): Promise<UrlInspectionResult> {
  const { accessToken, siteUrl } = await getSearchConsoleConnection();
  const data = await scFetch(`${SEARCHCONSOLE_BASE}/urlInspection/index:inspect`, accessToken, {
    method: "POST",
    body: JSON.stringify({ inspectionUrl, siteUrl }),
  });
  return data.inspectionResult ?? {};
}
