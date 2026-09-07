"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Reached via a redirect from GET /api/mcp/oauth/authorize once that route
// has validated the client_id/redirect_uri. AuthWrapper (src/app/admin/layout.tsx)
// already gates everything under /admin behind login, so by the time this
// component renders there is a real Supabase session — this page's only job
// is showing what's being authorized and, on approval, exchanging that
// session for an MCP authorization code via /api/mcp/oauth/authorize/complete.
function McpAuthorizeContent() {
  const params = useSearchParams();
  const { session, user } = useAuth();
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const codeChallenge = params.get("code_challenge") ?? "";
  const scope = params.get("scope") ?? "mcp:read";
  const state = params.get("state");
  const clientName = params.get("client_name") || clientId;

  const scopes = scope.split(/\s+/).filter(Boolean);

  const handleApprove = async () => {
    if (!session?.access_token) return;
    setStatus("working");
    setErrorMessage(null);
    try {
      const response = await fetch("/api/mcp/oauth/authorize/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supabaseAccessToken: session.access_token,
          client_id: clientId,
          redirect_uri: redirectUri,
          code_challenge: codeChallenge,
          scope,
          state,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrorMessage(data.error_description ?? "Authorization failed");
        setStatus("error");
        return;
      }
      window.location.href = data.redirectTo;
    } catch {
      setErrorMessage("Network error while completing authorization");
      setStatus("error");
    }
  };

  const handleDeny = () => {
    const url = new URL(redirectUri);
    url.searchParams.set("error", "access_denied");
    if (state) url.searchParams.set("state", state);
    window.location.href = url.toString();
  };

  if (!clientId || !redirectUri || !codeChallenge) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>Missing or invalid authorization request parameters.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connect to Social Media MCP</CardTitle>
          <CardDescription>
            <strong>{clientName}</strong> wants to access the Social Media Hub as{" "}
            <strong>{user?.email}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Requested access:</p>
            <div className="flex flex-wrap gap-2">
              {scopes.includes("mcp:read") && <Badge variant="secondary">Read videos, accounts, metrics</Badge>}
              {scopes.includes("mcp:write") && <Badge variant="destructive">Approve, schedule and publish content</Badge>}
            </div>
          </div>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleDeny} disabled={status === "working"}>
              Deny
            </Button>
            <Button className="flex-1" onClick={handleApprove} disabled={status === "working"}>
              {status === "working" ? "Authorizing..." : "Authorize"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function McpAuthorizePage() {
  return (
    <Suspense fallback={null}>
      <McpAuthorizeContent />
    </Suspense>
  );
}
