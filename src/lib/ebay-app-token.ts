// A separate, simpler token from getEbayAccessToken (@/lib/ebay-token): that one is the
// seller's own OAuth token (sell.* scopes, refreshed from a stored refresh_token) used to
// manage their listings/orders. Browse API search is public data — it just needs an
// "application" token via the client_credentials grant, no seller connection required at
// all, so this works even before/without the seller ever connecting their eBay account.
let cached: { token: string; expiresAt: number } | null = null;

export async function getEbayAppToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID ?? process.env.EBAY_CLIENT_SECRET;
  if (!appId || !certId) {
    throw new Error("EBAY_APP_ID / EBAY_CERT_ID não configurados no servidor.");
  }

  const credentials = Buffer.from(`${appId}:${certId}`).toString("base64");
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ao obter token de aplicação do eBay: ${err}`);
  }

  const data = await res.json();
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cached.token;
}
