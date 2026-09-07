"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authedFetch } from "@/lib/admin-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { Eye, Heart, TrendingUp } from "lucide-react";

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
    engagement: number | null;
  } | null;
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("pt-BR");
}

function sum(rows: PerformanceRow[], field: "views" | "engagement"): number {
  return rows.reduce((acc, r) => acc + (r.metrics?.[field] ?? 0), 0);
}

export default function SocialMediaAnalyticsPage() {
  const [platform, setPlatform] = useState<string>("all");
  const [rows, setRows] = useState<PerformanceRow[] | null>(null);

  const load = useCallback(async (p: string) => {
    const qs = p !== "all" ? `&platform=${p}` : "";
    const res = await authedFetch(`/api/social-media/performance?limit=50${qs}`);
    const data = await res.json();
    if (res.ok) setRows(data.publications);
  }, []);

  useEffect(() => {
    load(platform);
  }, [platform, load]);

  const chartData = useMemo(
    () =>
      (rows ?? []).slice(0, 10).map((r) => ({
        name: (r.video_filename ?? r.publication_id).slice(0, 18),
        engajamento: r.metrics?.engagement ?? 0,
      })),
    [rows]
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">Desempenho do conteúdo publicado, com dados reais sincronizados de cada plataforma.</p>
        </div>
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas plataformas</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rows === null ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Publicações</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{rows.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Views totais</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(sum(rows, "views"))}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Engajamento total</CardTitle>
                <Heart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(sum(rows, "engagement"))}</div>
              </CardContent>
            </Card>
          </div>

          {rows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 10 por engajamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="engajamento" fill="#db3614" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Todas as publicações</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {rows.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nada publicado ainda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vídeo</TableHead>
                      <TableHead>Plataforma</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead className="text-right">Curtidas</TableHead>
                      <TableHead className="text-right">Coment.</TableHead>
                      <TableHead className="text-right">Compart.</TableHead>
                      <TableHead className="text-right">Engajamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.publication_id}>
                        <TableCell className="max-w-[220px]">
                          {r.url ? (
                            <a href={r.url} target="_blank" rel="noreferrer" className="truncate block hover:underline text-sm">
                              {r.video_filename ?? "(vídeo)"}
                            </a>
                          ) : (
                            <span className="truncate block text-sm">{r.video_filename ?? "(vídeo)"}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.platform}</TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {r.published_at ? new Date(r.published_at).toLocaleDateString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(r.metrics?.views)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(r.metrics?.likes)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(r.metrics?.comments)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(r.metrics?.shares)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{formatNumber(r.metrics?.engagement)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
