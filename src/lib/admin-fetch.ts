import { supabase } from "@/integrations/supabase/client";

// Attaches the current Supabase session token so server-side admin routes
// (e.g. /api/admin/chat/*) can verify the caller, per src/lib/admin-auth.ts.
export async function authedFetch(url: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return fetch(url, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}
