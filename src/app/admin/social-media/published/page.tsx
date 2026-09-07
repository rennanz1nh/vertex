"use client";

import { useCallback, useEffect, useState } from "react";
import { authedFetch } from "@/lib/admin-fetch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video as VideoIcon, ExternalLink } from "lucide-react";

interface PerformanceRow {
  publication_id: string;
  platform: string;
  published_at: string | null;
  url: string | null;
  video_filename: string | null;
  metrics: {
    views: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    saves: number | null;
    last_synced_at: string | null;
  } | null;
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("pt-BR");
}

export default function SocialMediaPublishedPage() {
  const [rows, setRows] = useState<PerformanceRow[] | null>(null);

  const load = useCallback(async () => {
    const res = await authedFetch("/api/social-media/performance?limit=100");
    const data = await res.json();
    if (res.ok) setRows(data.publications);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Publicados</h1>
        <p className="text-sm text-muted-foreground">Tudo que já foi ao ar, com as métricas mais recentes sincronizadas.</p>
      </div>

      {rows === null ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Nada publicado ainda.</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row.publication_id}>
              <CardContent className="p-3 flex items-center gap-4">
                <div className="h-14 w-14 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  <VideoIcon className="h-5 w-5 opacity-40" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{row.video_filename ?? "(vídeo)"}</p>
                    <Badge variant="secondary" className="shrink-0">
                      {row.platform}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.published_at ? new Date(row.published_at).toLocaleString("pt-BR") : "—"}
                    {row.metrics?.last_synced_at && ` · métricas sincronizadas ${new Date(row.metrics.last_synced_at).toLocaleString("pt-BR")}`}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                  <div className="text-center">
                    <div className="font-semibold text-foreground tabular-nums">{formatNumber(row.metrics?.views)}</div>
                    <div>Views</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-foreground tabular-nums">{formatNumber(row.metrics?.likes)}</div>
                    <div>Curtidas</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-foreground tabular-nums">{formatNumber(row.metrics?.comments)}</div>
                    <div>Coment.</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-foreground tabular-nums">{formatNumber(row.metrics?.shares)}</div>
                    <div>Compart.</div>
                  </div>
                </div>
                {row.url && (
                  <a href={row.url} target="_blank" rel="noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
