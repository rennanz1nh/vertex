import type { AuthMetadataOptions } from "@modelcontextprotocol/server";
import { getAppUrl, getMcpIssuerUrl, getMcpResourceUrl, MCP_SCOPES } from "./config";

/** RFC 8414 Authorization Server metadata for this MCP's own minimal OAuth AS (see src/app/api/mcp/oauth/**). */
export function getAuthMetadataOptions(): AuthMetadataOptions {
  const issuer = getMcpIssuerUrl();
  return {
    oauthMetadata: {
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      registration_endpoint: `${issuer}/register`,
      scopes_supported: [...MCP_SCOPES],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
    },
    resourceServerUrl: new URL(getMcpResourceUrl()),
    resourceName: "Social Media MCP",
    scopesSupported: [...MCP_SCOPES],
    serviceDocumentationUrl: new URL("/admin/social-media/hub", getAppUrl()),
  };
}
