import { lookup } from "dns/promises";
import { isIPv4, isIPv6 } from "net";

const CIMD_FETCH_TIMEOUT_MS = 5000;
const CIMD_MAX_BYTES = 64 * 1024;

export interface ClientIdMetadata {
  client_id: string;
  client_name?: string;
  redirect_uris: string[];
}

/**
 * A CIMD `client_id` is an HTTPS URL the OAuth client controls, and we fetch
 * it ourselves during /authorize — server-side requests to a caller-supplied
 * URL are a textbook SSRF vector (cloud metadata endpoints, internal
 * services), so every resolved address is checked against private/reserved
 * ranges before the request is made, not just the hostname.
 */
async function assertPublicHttpsHost(url: URL): Promise<void> {
  if (url.protocol !== "https:") {
    throw new Error("client_id metadata URL must use https");
  }
  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.length === 0) {
    throw new Error("client_id host did not resolve to any address");
  }
  for (const { address, family } of addresses) {
    if (isPrivateOrReservedIp(address, family)) {
      throw new Error("client_id host resolves to a private or reserved address");
    }
  }
}

function isPrivateOrReservedIp(address: string, family: number): boolean {
  if (family === 4 || isIPv4(address)) {
    const parts = address.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true; // multicast (224/4) + reserved (240/4)
    return false;
  }
  if (family === 6 || isIPv6(address)) {
    const normalized = address.toLowerCase();
    if (normalized === "::1") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // fc00::/7 unique local
    if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true; // fe80::/10
    if (normalized.startsWith("::ffff:")) {
      // IPv4-mapped IPv6 — re-check the embedded IPv4 address.
      const mapped = normalized.split(":").pop() ?? "";
      if (isIPv4(mapped)) return isPrivateOrReservedIp(mapped, 4);
    }
    return false;
  }
  return true; // unknown family — reject rather than risk it
}

/**
 * Fetches and validates a Client ID Metadata Document (CIMD) — the
 * 2026-07-28 MCP spec's replacement for Dynamic Client Registration, where
 * the OAuth client's `client_id` is itself the HTTPS URL serving its
 * metadata. Returns null if the URL isn't fetchable/well-formed rather than
 * throwing, since an invalid CIMD `client_id` is a normal (client error)
 * outcome for /authorize to reject, not a server fault.
 */
export async function fetchClientIdMetadata(clientIdUrl: string): Promise<ClientIdMetadata | null> {
  let url: URL;
  try {
    url = new URL(clientIdUrl);
  } catch {
    return null;
  }
  if (url.hash) return null;

  try {
    await assertPublicHttpsHost(url);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CIMD_FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
        redirect: "error", // a redirect would let the target hop to an unvalidated host
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok || !response.body) return null;

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > CIMD_MAX_BYTES) return null;

    const reader = response.body.getReader();
    let received = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > CIMD_MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString("utf-8");
    const json = JSON.parse(text);

    if (json.client_id !== clientIdUrl) return null;
    if (!Array.isArray(json.redirect_uris) || json.redirect_uris.some((u: unknown) => typeof u !== "string")) return null;

    return {
      client_id: json.client_id,
      client_name: typeof json.client_name === "string" ? json.client_name : undefined,
      redirect_uris: json.redirect_uris,
    };
  } catch {
    return null;
  }
}
