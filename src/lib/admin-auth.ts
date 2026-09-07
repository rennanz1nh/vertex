import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Verifies the caller sent a valid Supabase session token. Chat messages contain
 * customer PII (name, email hints, message content), so unlike most admin API
 * routes in this project this one is checked server-side rather than relying on
 * client-side gating alone (see project memory: no-auth-on-admin-routes finding).
 */
export async function requireAdmin(request: NextRequest): Promise<{ ok: boolean; status: number; userId?: string }> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { ok: false, status: 401 };

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { ok: false, status: 401 };
  return { ok: true, status: 200, userId: data.user.id };
}
