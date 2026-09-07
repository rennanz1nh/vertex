import type { AuthInfo } from "@modelcontextprotocol/server";
import { getUserRole, verifyAccessToken } from "./oauth-store";

export interface McpAuthExtra {
  userId: string;
  role: "admin" | "operador" | "leitura";
}

export async function verifyMcpToken(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  const verified = await verifyAccessToken(bearerToken);
  if (!verified) return undefined;

  const role = await getUserRole(verified.userId);
  if (!role) return undefined;

  const extra: McpAuthExtra = { userId: verified.userId, role };
  return {
    token: bearerToken,
    clientId: verified.clientId,
    scopes: verified.scope.split(/\s+/).filter(Boolean),
    expiresAt: Math.floor(new Date(verified.expiresAt).getTime() / 1000),
    extra: extra as unknown as Record<string, unknown>,
  };
}
