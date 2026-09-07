/** https everywhere, except the loopback exception RFC 8252 carves out for native/CLI apps (e.g. Claude Desktop/Code's local OAuth callback). */
export function isAllowedRedirectUri(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  const loopbackHosts = ["127.0.0.1", "localhost", "[::1]", "::1"];
  return url.protocol === "http:" && loopbackHosts.includes(url.hostname);
}
