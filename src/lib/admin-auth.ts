import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isMasterAdminEmail } from "@/lib/master-admin";

function authClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

function bearer(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization") ?? "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

/**
 * Verifies the caller sent a valid Supabase session token. Chat messages contain
 * customer PII (name, email hints, message content), so unlike most admin API
 * routes in this project this one is checked server-side rather than relying on
 * client-side gating alone (see project memory: no-auth-on-admin-routes finding).
 */
export async function requireAdmin(request: NextRequest): Promise<{ ok: boolean; status: number; userId?: string }> {
  const token = bearer(request);
  if (!token) return { ok: false, status: 401 };

  const { data, error } = await authClient().auth.getUser(token);
  if (error || !data.user) return { ok: false, status: 401 };
  return { ok: true, status: 200, userId: data.user.id };
}

/**
 * Stricter gate: a valid session AND the master-admin account (see master-admin.ts).
 * Used to lock the Turo integration to a single owner account for now.
 */
export async function requireMasterAdmin(request: NextRequest): Promise<{ ok: boolean; status: number; userId?: string }> {
  const token = bearer(request);
  if (!token) return { ok: false, status: 401 };

  const { data, error } = await authClient().auth.getUser(token);
  if (error || !data.user) return { ok: false, status: 401 };
  if (!isMasterAdminEmail(data.user.email)) return { ok: false, status: 403 };
  return { ok: true, status: 200, userId: data.user.id };
}
