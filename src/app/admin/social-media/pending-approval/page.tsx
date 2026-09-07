"use client";

import { useCallback, useEffect, useState } from "react";
import { authedFetch } from "@/lib/admin-fetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Loader2, Send, CalendarClock, Video as VideoIcon } from "lucide-react";

interface PreviewContent {
  title: string;
  caption: string;
  hashtags: string[];
  extra: Record<string, unknown>;
}

interface PublicationPreview {
  publication: { id: string; platform: string; status: string; approval_status: string; created_at: string };
  video: { id: string; filename: string; thumbnailUrl: string | null };
  content: PreviewContent | null;
  account: { id: string; account_name: string | null } | null;
}

export default function PendingApprovalPage() {
  const [previews, setPreviews] = useState<PublicationPreview[] | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    const response = await authedFetch("/api/social-media/publications?approval_status=PENDING");
    if (!response.ok) {
      toast({ title: "Falha ao carregar aprovações pendentes", variant: "destructive" });
      return;
    }
    const data = await response.json();
    const detailed = await Promise.all(
      (data.publications as { id: string }[]).map(async (p) => {
        const detailResponse = await authedFetch(`/api/social-media/publications/${p.id}`);
        return detailResponse.ok ? ((await detailResponse.json()) as PublicationPreview) : null;
      })
    );
    setPreviews(detailed.filter((p): p is PublicationPreview => p !== null));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (id: string) => {
    setBusyId(id);
    const response = await authedFetch(`/api/social-media/publications/${id}/approve`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      toast({ title: "Não foi possível aprovar", description: data.error, variant: "destructive" });
    } else {
      toast({ title: "Publicação aprovada" });
      await load();
    }
    setBusyId(null);
  };

  const handleReject = async (id: string) => {
    setBusyId(id);
    const response = await authedFetch(`/api/social-media/publications/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason || "Nenhum motivo informado" }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast({ title: "Não foi possível rejeitar", description: data.error, variant: "destructive" });
    } else {
      toast({ title: "Publicação rejeitada" });
      setRejecting(null);
      setRejectReason("");
      await load();
    }
    setBusyId(null);
  };

  // Publish Now needs an approved publication — approve, then publish in one click for reviewers
  // who don't want a separate trip to the Calendar/Published pages just to fire it off.
  const handlePublishNow = async (id: string) => {
    setBusyId(id);
    try {
      const approveRes = await authedFetch(`/api/social-media/publications/${id}/approve`, { method: "POST" });
      if (!approveRes.ok) {
        const data = await approveRes.json();
        toast({ title: "Não foi possível aprovar", description: data.error, variant: "destructive" });
        return;
      }
      const publishRes = await authedFetch(`/api/social-media/publications/${id}/publish`, { method: "POST" });
      const data = await publishRes.json();
      if (!publishRes.ok) {
        toast({ title: "Falha ao publicar", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Publicado!", description: data.publication?.permalink ?? undefined });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const handleSchedule = async (id: string) => {
    if (!scheduleAt) {
      toast({ title: "Escolha data e hora", variant: "destructive" });
      return;
    }
    setBusyId(id);
    try {
      const approveRes = await authedFetch(`/api/social-media/publications/${id}/approve`, { method: "POST" });
      if (!approveRes.ok) {
        const data = await approveRes.json();
        toast({ title: "Não foi possível aprovar", description: data.error, variant: "destructive" });
        return;
      }
      const scheduleRes = await authedFetch(`/api/social-media/publications/${id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_at: new Date(scheduleAt).toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      const data = await scheduleRes.json();
      if (!scheduleRes.ok) {
        toast({ title: "Falha ao agendar", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Publicação agendada" });
      setScheduling(null);
      setScheduleAt("");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Aprovações Pendentes</h1>
        <p className="text-sm text-muted-foreground">Revise as legendas e hashtags geradas antes de publicar.</p>
      </div>

      {previews === null ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : previews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Nada esperando aprovação no momento.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {previews.map(({ publication, video, content, account }) => (
            <Card key={publication.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm truncate">{video.filename}</CardTitle>
                  <Badge variant="secondary">{publication.platform}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-3">
                  <div className="h-20 w-20 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
                    {video.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <VideoIcon className="h-6 w-6 opacity-40" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    {account?.account_name && <p className="text-xs text-muted-foreground">Conta: {account.account_name}</p>}
                    {content ? (
                      <div className="space-y-1 text-sm">
                        <p className="font-medium truncate">{content.title}</p>
                        <p className="whitespace-pre-wrap text-muted-foreground line-clamp-3">{content.caption}</p>
                        <p className="text-xs text-blue-600 truncate">{content.hashtags.map((h) => `#${h}`).join(" ")}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum conteúdo gerado.</p>
                    )}
                  </div>
                </div>

                {rejecting === publication.id ? (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Por que está sendo rejeitado?"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setRejecting(null)}>
                        Cancelar
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleReject(publication.id)} disabled={busyId === publication.id}>
                        Confirmar rejeição
                      </Button>
                    </div>
                  </div>
                ) : scheduling === publication.id ? (
                  <div className="space-y-2">
                    <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setScheduling(null)}>
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={() => handleSchedule(publication.id)} disabled={busyId === publication.id}>
                        {busyId === publication.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CalendarClock className="h-4 w-4 mr-1" />}
                        Confirmar agendamento
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" onClick={() => handleApprove(publication.id)} disabled={busyId === publication.id}>
                      {busyId === publication.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                      Aprovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handlePublishNow(publication.id)} disabled={busyId === publication.id || !content}>
                      <Send className="h-4 w-4 mr-1" />
                      Publicar agora
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setScheduling(publication.id)} disabled={busyId === publication.id || !content}>
                      <CalendarClock className="h-4 w-4 mr-1" />
                      Agendar
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setRejecting(publication.id)} disabled={busyId === publication.id}>
                      <X className="h-4 w-4 mr-1" />
                      Rejeitar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
