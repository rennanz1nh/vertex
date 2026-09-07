import { NextRequest, NextResponse } from "next/server";
import { oauthMetadataResponse } from "@modelcontextprotocol/server";
import { metadataCorsOptionsRequestHandler } from "mcp-handler";
import { getAuthMetadataOptions } from "@/lib/mcp/metadata";

export const dynamic = "force-dynamic";

// Serves both RFC 9728 (/.well-known/oauth-protected-resource/api/mcp) and
// RFC 8414 (/.well-known/oauth-authorization-server) from one catch-all —
// oauthMetadataResponse matches the request path itself and returns
// undefined for anything else under .well-known/.
export async function GET(request: NextRequest) {
  const response = oauthMetadataResponse(request, getAuthMetadataOptions());
  return response ?? NextResponse.json({ error: "not_found" }, { status: 404 });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
