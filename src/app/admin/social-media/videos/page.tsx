"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { authedFetch } from "@/lib/admin-fetch";
import { computeSha256, extractVideoMetadata, captureVideoThumbnail } from "@/lib/social-media/video-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Trash2, Video as VideoIcon, Sparkles, FileText } from "lucide-react";

interface VideoRow {
  id: string;
  filename: string;
  status: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  thumbnail_path: string | null;
  thumbnailUrl: string | null;
  created_at: string;
}

interface PlatformContent {
  title: string;
  caption: string;
  hashtags: string[];
  extra: Record<string, unknown>;
}

interface VideoDetail {
  video: VideoRow;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  analysis: { subject: string; setting: string; target_audience: string; sentiment: string; theme: string; suggested_titles: string[]; keywords: string[] } | null;
  content: Record<string, PlatformContent | null>;
  publications: { id: string; platform: string; status: string; approval_status: string }[];
}

interface ConnectedAccount {
  accountId: string | null;
  platform: string;
  label: string;
  connected: boolean;
  canPublish: boolean;
  accountName: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  NEW: "Novo",
  ANALYZING: "Analisando",
  READY_FOR_REVIEW: "Pronto p/ revisão",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  SCHEDULED: "Agendado",
  PUBLISHING: "Publicando",
  PUBLISHED: "Publicado",
  FAILED: "Falhou",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  NEW: "secondary",
  ANALYZING: "secondary",
  READY_FOR_REVIEW: "default",
  APPROVED: "default",
  REJECTED: "destructive",
  SCHEDULED: "outline",
  PUBLISHING: "outline",
  PUBLISHED: "default",
  FAILED: "destructive",
};

const GENERATABLE_PLATFORMS = ["instagram", "tiktok"] as const;

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SocialMediaVideosPage() {
  const [videos, setVideos] = useState<VideoRow[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [detail, setDetail] = useState<VideoDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedAccountByPlatform, setSelectedAccountByPlatform] = useState<Record<string, string>>({});

  const loadVideos = useCallback(async () => {
    const qs = statusFilter !== "all" ? `?status=${statusFilter}` : "";
    const response = await authedFetch(`/api/social-media/videos${qs}`);
    if (!response.ok) {
      toast({ title: "Falha ao carregar vídeos", variant: "destructive" });
      return;
    }
    const data = await response.json();
    setVideos(data.videos);
  }, [statusFilter, toast]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  useEffect(() => {
    authedFetch("/api/social/status")
      .then((r) => r.json())
      .then((data) => setAccounts(data.platforms ?? []))
      .catch(() => {});
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await authedFetch(`/api/social-media/videos/${id}/detail`);
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Falha ao carregar detalhes", description: data.error, variant: "destructive" });
        return;
      }
      setDetail(data);
    } finally {
      setLoadingDetail(false);
    }
  }, [toast]);

  const openDetail = (id: string) => {
    setSelectedVideoId(id);
    setDetail(null);
    loadDetail(id);
  };

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast({ title: "Arquivo não é um vídeo", description: file.type || file.name, variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      setUploadStage("Calculando hash (verificando duplicados)...");
      const sha256Hash = await computeSha256(file);

      setUploadStage("Lendo metadados do vídeo...");
      const metadata = await extractVideoMetadata(file).catch(() => null);

      setUploadStage("Enviando vídeo...");
      const ext = file.name.split(".").pop() || "mp4";
      const videoPath = `processing/${sha256Hash}/original.${ext}`;
      const { error: uploadError } = await supabase.storage.from("vertex-social-media").upload(videoPath, file, {
        upsert: true,
        contentType: file.type,
      });
      if (uploadError) throw new Error(uploadError.message);

      let thumbnailPath: string | null = null;
      try {
        setUploadStage("Gerando thumbnail...");
        const thumbnailBlob = await captureVideoThumbnail(file);
        thumbnailPath = `processing/${sha256Hash}/thumbnail.jpg`;
        const { error: thumbError } = await supabase.storage
          .from("vertex-social-media")
          .upload(thumbnailPath, thumbnailBlob, { upsert: true, contentType: "image/jpeg" });
        if (thumbError) thumbnailPath = null;
      } catch {
        thumbnailPath = null;
      }

      setUploadStage("Registrando vídeo...");
      const response = await authedFetch("/api/social-media/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath: videoPath,
          filename: file.name,
          sha256Hash,
          thumbnailPath,
          durationSeconds: metadata?.durationSeconds ?? null,
          width: metadata?.width ?? null,
          height: metadata?.height ?? null,
          fileSize: file.size,
          format: file.type,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Falha ao registrar vídeo");

      toast({
        title: data.duplicate ? "Já está na biblioteca" : "Vídeo enviado",
        description: data.duplicate ? "Este arquivo já estava registrado — reaproveitando." : file.name,
      });
      await loadVideos();
    } catch (error) {
      toast({ title: "Falha no envio", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadStage(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    const response = await authedFetch(`/api/social-media/videos/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      toast({ title: "Não foi possível excluir", description: data.error, variant: "destructive" });
      return;
    }
    toast({ title: "Vídeo excluído" });
    if (selectedVideoId === id) setSelectedVideoId(null);
    await loadVideos();
  };

  const handleAnalyze = async () => {
    if (!selectedVideoId) return;
    setBusyAction("analyze");
    try {
      const res = await authedFetch(`/api/social-media/videos/${selectedVideoId}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Falha na análise", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Vídeo analisado" });
      await Promise.all([loadDetail(selectedVideoId), loadVideos()]);
    } finally {
      setBusyAction(null);
    }
  };

  const handleGenerateContent = async (platform: string) => {
    if (!selectedVideoId) return;
    setBusyAction(`generate-${platform}`);
    try {
      const res = await authedFetch(`/api/social-media/videos/${selectedVideoId}/generate-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms: [platform] }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Falha ao gerar conteúdo", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Conteúdo gerado" });
      await loadDetail(selectedVideoId);
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreatePublication = async (platform: string) => {
    if (!selectedVideoId) return;
    const accountId = selectedAccountByPlatform[platform];
    if (!accountId) {
      toast({ title: "Selecione uma conta primeiro", variant: "destructive" });
      return;
    }
    setBusyAction(`publish-${platform}`);
    try {
      const res = await authedFetch("/api/social-media/publications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: selectedVideoId, platform, account_id: accountId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Falha ao criar publicação", description: data.error, variant: "destructive" });
        return;
      }
      toast({
        title: data.already_existed ? "Publicação já existia" : "Publicação criada",
        description: data.publication?.status === "PUBLISHED" ? "Publicado automaticamente (modo AUTO)." : "Veja em Aprovações para revisar.",
      });
      await Promise.all([loadDetail(selectedVideoId), loadVideos()]);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Biblioteca de Vídeos</h1>
          <p className="text-sm text-muted-foreground">Envie vídeos aqui para disponibilizá-los ao Social Media MCP.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleFileSelected(e.target.files?.[0])}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {uploading ? uploadStage ?? "Enviando..." : "Enviar vídeo"}
          </Button>
        </div>
      </div>

      {videos === null ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : videos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <VideoIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            Nenhum vídeo ainda. Envie um para começar, ou solte na pasta automática (inbox).
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {videos.map((video) => (
            <Card key={video.id} className="cursor-pointer hover:border-muted-foreground/30 transition-colors" onClick={() => openDetail(video.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-medium truncate" title={video.filename}>
                    {video.filename}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(video.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="aspect-video bg-muted rounded overflow-hidden flex items-center justify-center text-muted-foreground">
                  {video.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <VideoIcon className="h-6 w-6 opacity-40" />
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatDuration(video.duration_seconds)}</span>
                  <span>{video.width && video.height ? `${video.width}×${video.height}` : "—"}</span>
                </div>
                <Badge variant={STATUS_VARIANT[video.status] ?? "secondary"}>{STATUS_LABEL[video.status] ?? video.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!selectedVideoId} onOpenChange={(open) => !open && setSelectedVideoId(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{detail?.video.filename ?? "Detalhes do vídeo"}</SheetTitle>
          </SheetHeader>

          {loadingDetail || !detail ? (
            <p className="text-sm text-muted-foreground mt-4">Carregando...</p>
          ) : (
            <div className="space-y-6 mt-4">
              <div className="aspect-video bg-muted rounded overflow-hidden flex items-center justify-center">
                {detail.videoUrl ? (
                  <video src={detail.videoUrl} controls className="h-full w-full object-contain" poster={detail.thumbnailUrl ?? undefined} />
                ) : detail.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={detail.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <VideoIcon className="h-8 w-8 opacity-40" />
                )}
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={STATUS_VARIANT[detail.video.status] ?? "secondary"}>{STATUS_LABEL[detail.video.status] ?? detail.video.status}</Badge>
                <span className="text-xs text-muted-foreground">{formatDuration(detail.video.duration_seconds)}</span>
              </div>

              <Separator />

              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Análise de IA
                </h3>
                {detail.analysis ? (
                  <div className="text-sm space-y-1 text-muted-foreground">
                    <p>
                      <span className="text-foreground font-medium">Assunto:</span> {detail.analysis.subject}
                    </p>
                    <p>
                      <span className="text-foreground font-medium">Público-alvo:</span> {detail.analysis.target_audience}
                    </p>
                    <p>
                      <span className="text-foreground font-medium">Sentimento:</span> {detail.analysis.sentiment}
                    </p>
                    <p>
                      <span className="text-foreground font-medium">Palavras-chave:</span> {detail.analysis.keywords.join(", ")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Este vídeo ainda não foi analisado.</p>
                    <Button size="sm" onClick={handleAnalyze} disabled={!detail.thumbnailUrl || busyAction === "analyze"}>
                      {busyAction === "analyze" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
                      Analisar vídeo
                    </Button>
                    {!detail.thumbnailUrl && <p className="text-xs text-destructive">Sem thumbnail — não é possível analisar.</p>}
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Conteúdo por plataforma
                </h3>
                {GENERATABLE_PLATFORMS.map((platform) => {
                  const content = detail.content[platform];
                  const platformAccounts = accounts.filter((a) => a.platform === platform && a.connected);
                  const existingPub = detail.publications.find((p) => p.platform === platform);
                  return (
                    <div key={platform} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase text-muted-foreground">{platform}</span>
                        {existingPub && <Badge variant="outline">{existingPub.status}</Badge>}
                      </div>

                      {content ? (
                        <div className="space-y-1 text-sm">
                          <p className="font-medium">{content.title}</p>
                          <p className="text-muted-foreground whitespace-pre-wrap">{content.caption}</p>
                          <p className="text-xs text-blue-600">{content.hashtags.map((h) => `#${h}`).join(" ")}</p>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleGenerateContent(platform)}
                          disabled={!detail.analysis || busyAction === `generate-${platform}`}
                        >
                          {busyAction === `generate-${platform}` ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Gerar conteúdo
                        </Button>
                      )}

                      {content && !existingPub && (
                        <div className="flex items-center gap-2 pt-1">
                          <Select
                            value={selectedAccountByPlatform[platform] ?? ""}
                            onValueChange={(value) => setSelectedAccountByPlatform((prev) => ({ ...prev, [platform]: value }))}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue placeholder="Escolher conta" />
                            </SelectTrigger>
                            <SelectContent>
                              {platformAccounts.length === 0 ? (
                                <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma conta conectada</div>
                              ) : (
                                platformAccounts.map((a) => (
                                  <SelectItem key={a.accountId} value={a.accountId ?? ""}>
                                    {a.accountName ?? a.label}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <Button size="sm" onClick={() => handleCreatePublication(platform)} disabled={busyAction === `publish-${platform}`}>
                            {busyAction === `publish-${platform}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Criar publicação"}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
