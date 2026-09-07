"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Grid3x3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FacebookLogo, InstagramLogo, TikTokLogo, YouTubeLogo, PinterestLogo } from "@/components/brand-logos";
import { PlatformConnectionCard, type PlatformStatus } from "@/components/social-media/PlatformConnectionCard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { authedFetch } from "@/lib/admin-fetch";

// Only these have a publishing adapter (src/lib/social-media/platforms/) — the other
// platforms stay read-only, so their cards never show the auto-publish row at all.
const PUBLISH_CAPABLE_PLATFORMS = new Set(["instagram", "tiktok"]);

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <InstagramLogo className="h-5 w-5" />,
  facebook: <FacebookLogo className="h-5 w-5" />,
  tiktok: <TikTokLogo className="h-5 w-5" />,
  youtube: <YouTubeLogo className="h-5 w-5" />,
  pinterest: <PinterestLogo className="h-5 w-5" />,
};

interface SocialPost {
  id: string;
  caption: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  publishedAt: string | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  views: number | null;
}
interface SocialInsights {
  followers: number | null;
  postCount: number | null;
  posts: SocialPost[];
}

function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("pt-BR");
}

function engagementOf(p: SocialPost): number {
  return (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0);
}

export default function SocialMediaHub() {
  const { toast } = useToast();

  const [platforms, setPlatforms] = useState<PlatformStatus[] | null>(null);
  const [selected, setSelected] = useState<string>("instagram");
  const [insights, setInsights] = useState<SocialInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [togglingAutoPublish, setTogglingAutoPublish] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await authedFetch("/api/social/status");
    const data = await res.json();
    if (data.platforms) setPlatforms(data.platforms);
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Feedback from the OAuth callback redirect (?social_connected=x / ?social_error=x).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("social_connected");
    const error = params.get("social_error");
    const platform = params.get("social_platform");
    if (connected) {
      toast({ title: "Conectado!", description: `Conta ${connected} conectada com sucesso.` });
      loadStatus();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (error) {
      toast({ title: `Erro ao conectar${platform ? ` (${platform})` : ""}`, description: error, variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadInsights = useCallback(async (platform: string) => {
    setLoadingInsights(true);
    setInsightsError(null);
    setInsights(null);
    try {
      const res = await authedFetch(`/api/social/${platform}/insights`);
      const data = await res.json();
      if (!res.ok) {
        setInsightsError(data.error ?? "Falha ao carregar métricas");
      } else {
        setInsights(data);
      }
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingInsights(false);
    }
  }, []);

  useEffect(() => {
    const current = platforms?.find((p) => p.platform === selected);
    if (current?.connected) loadInsights(selected);
    else {
      setInsights(null);
      setInsightsError(null);
    }
  }, [selected, platforms, loadInsights]);

  const handleConnect = (platform: string) => {
    const status = platforms?.find((p) => p.platform === platform);
    if (status && !status.configured) {
      toast({
        title: "Credenciais não configuradas",
        description: `Cadastre um app de desenvolvedor para ${status.label} e configure as credenciais no servidor (variáveis de ambiente na Vercel) antes de conectar.`,
        variant: "destructive",
      });
      return;
    }
    window.location.href = `/api/social/${platform}/authorize?returnTo=${encodeURIComponent("/admin/social-media/hub")}`;
  };

  const handleDisconnect = async (platform: string) => {
    setDisconnecting(platform);
    try {
      await authedFetch(`/api/social/${platform}/disconnect`, { method: "POST" });
      await loadStatus();
      toast({ title: "Desconectado", description: `Conta de ${platform} desconectada.` });
    } finally {
      setDisconnecting(null);
    }
  };

  const handleToggleAutoPublish = async (platform: string, enabled: boolean) => {
    setTogglingAutoPublish(platform);
    try {
      const res = await authedFetch(`/api/social/${platform}/auto-publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Não foi possível alterar", description: data.error, variant: "destructive" });
        return;
      }
      await loadStatus();
      toast({
        title: enabled ? "Publicação automática ativada" : "Publicação automática desativada",
        description: enabled ? "Esta conta agora publica sem revisão humana quando o modo AUTO estiver ligado." : undefined,
      });
    } finally {
      setTogglingAutoPublish(null);
    }
  };

  const selectedStatus = platforms?.find((p) => p.platform === selected);
  const topPosts = insights?.posts
    ? [...insights.posts].sort((a, b) => engagementOf(b) - engagementOf(a)).slice(0, 5)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">HUB</h1>
        <p className="text-muted-foreground text-sm">
          Conexões e métricas das suas redes sociais — leitura apenas, as publicações continuam sendo feitas por você em cada rede.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        {platforms
          ? platforms.map((p) => (
              <PlatformConnectionCard
                key={p.platform}
                status={p}
                icon={PLATFORM_ICONS[p.platform]}
                active={selected === p.platform}
                disconnecting={disconnecting === p.platform}
                onSelect={() => setSelected(p.platform)}
                onConnect={() => handleConnect(p.platform)}
                onDisconnect={() => handleDisconnect(p.platform)}
                onToggleAutoPublish={PUBLISH_CAPABLE_PLATFORMS.has(p.platform) ? (enabled) => handleToggleAutoPublish(p.platform, enabled) : undefined}
                togglingAutoPublish={togglingAutoPublish === p.platform}
              />
            ))
          : [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="flex-1 min-w-[200px] h-[104px] rounded-lg" />)}
      </div>

      {selectedStatus && !selectedStatus.connected && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {selectedStatus.configured
              ? `Conecte sua conta do ${selectedStatus.label} acima para ver métricas aqui.`
              : `${selectedStatus.label} ainda não tem credenciais de app configuradas no servidor.`}
          </CardContent>
        </Card>
      )}

      {selectedStatus?.connected && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Seguidores</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loadingInsights ? <Skeleton className="h-8 w-20" /> : formatNumber(insights?.followers ?? null)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Publicações</CardTitle>
                <Grid3x3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loadingInsights ? <Skeleton className="h-8 w-20" /> : formatNumber(insights?.postCount ?? null)}</div>
              </CardContent>
            </Card>
          </div>

          {insightsError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {insightsError}
            </div>
          )}

          {!insightsError && topPosts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Posts que mais performam</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topPosts.map((p, i) => ({ name: `#${i + 1}`, engajamento: engagementOf(p) }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="engajamento" fill="#db3614" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {!insightsError && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Últimos posts</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingInsights ? (
                  <div className="p-6 space-y-3">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : insights?.posts.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Post</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Curtidas</TableHead>
                        <TableHead className="text-right">Comentários</TableHead>
                        <TableHead className="text-right">Compart.</TableHead>
                        <TableHead className="text-right">Views</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {insights.posts.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="max-w-[280px]">
                            <a href={p.permalink ?? undefined} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline">
                              {p.thumbnailUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.thumbnailUrl} alt="" className="h-9 w-9 rounded object-cover shrink-0" />
                              )}
                              <span className="truncate text-sm">{p.caption || "(sem legenda)"}</span>
                            </a>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("pt-BR") : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(p.likes)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(p.comments)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(p.shares)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(p.views)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-8">Nenhum post encontrado</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
