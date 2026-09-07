"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SiteSettings } from "@/lib/seo";

// Loads and saves the single-row site_settings table (SEO defaults + Google/
// Facebook tag IDs + LocalBusiness fields). Shared by the SEO/Google/Facebook tabs.
export function useSiteSettings() {
  const [row, setRow] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("site_settings").select("*").limit(1).maybeSingle();
    setRow((data as SiteSettings | null) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = useCallback(
    <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
      setRow((r) => (r ? { ...r, [key]: value } : r)),
    []
  );

  const save = useCallback(async (): Promise<boolean> => {
    if (!row) return false;
    setSaving(true);
    const patch: Partial<SiteSettings> = { ...row };
    delete patch.id;
    delete patch.updated_at;
    const { error } = await supabase
      .from("site_settings")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    setSaving(false);
    return !error;
  }, [row]);

  return { row, loading, saving, setField, save, reload: load };
}
