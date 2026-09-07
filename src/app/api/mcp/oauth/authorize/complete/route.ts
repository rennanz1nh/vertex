import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAuthorizationCode, getUserRole, resolveClient } from "@/lib/mcp/oauth-store";
import { parseScope } from "@/lib/mcp/config";

export const dynamic = "force-dynamic";

/**
 * Completes the /authorize hand-off once the admin has signed in on the
 * mcp-authorize page (see that page for why: this app has no server-side
 * session, so authentication happens there with the ordinary Supabase
 * browser client, and its resulting access token is handed here — once,
 * over HTTPS, from our own first-party page — to mint the authorization
 * code). Re-validates the client/redirect_uri itself rather than trusting
 * the values the page already checked once.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { supabaseAccessToken, client_id, redirect_uri, code_challenge, scope, state } = body ?? {};

  if (
    typeof supabaseAccessToken !== "string" ||
    typeof client_id !== "string" ||
    typeof redirect_uri !== "string" ||
    typeof code_challenge !== "string"
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
  const { data: userData, error: userError } = await supabase.auth.getUser(supabaseAccessToken);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "access_denied", error_description: "Not signed in" }, { status: 401 });
  }

  const role = await getUserRole(userData.user.id);
  if (!role) {
    return NextResponse.json({ error: "access_denied", error_description: "No profile for this account" }, { status: 403 });
  }

  const requestedScope = parseScope(typeof scope === "string" ? scope : null);
  if (requestedScope.includes("mcp:write") && role === "leitura") {
    return NextResponse.json(
      { error: "access_denied", error_description: "This account does not have permission to authorize write access" },
      { status: 403 }
    );
  }

  const client = await resolveClient(client_id);
  if (!client || !client.redirect_uris.includes(redirect_uri)) {
    return NextResponse.json({ error: "invalid_request", error_description: "Unknown client or redirect_uri" }, { status: 400 });
  }

  const code = await createAuthorizationCode({
    clientId: client_id,
    redirectUri: redirect_uri,
    codeChallenge: code_challenge,
    scope: requestedScope,
    userId: userData.user.id,
  });

  const redirectTo = new URL(redirect_uri);
  redirectTo.searchParams.set("code", code);
  if (typeof state === "string" && state) redirectTo.searchParams.set("state", state);

  return NextResponse.json({ redirectTo: redirectTo.toString() });
}
