"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { authedFetch } from "@/lib/admin-fetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Loader2, Video as VideoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PublicationRow {
  id: string;
  platform: string;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
}

interface PublicationPreview {
  publication: { id: string; platform: string; status: string; approval_status: string; scheduled_at: string | null; published_at: string | null; permalink: string | null };
  video: { id: string; filename: string; thumbnailUrl: string | null };
  content: { title: string; caption: string; hashtags: string[] } | null;
  account: { id: string; account_name: string | null } | null;
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function SocialMediaCalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const [publications, setPublications] = useState<PublicationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PublicationPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [scheduledRes, publishedRes] = await Promise.all([
        authedFetch("/api/social-media/publications?status=SCHEDULED&limit=200"),
        authedFetch("/api/social-media/publications?status=PUBLISHED&limit=200"),
      ]);
      const [scheduled, published] = await Promise.all([scheduledRes.json(), publishedRes.json()]);
      setPublications([...(scheduled.publications ?? []), ...(published.publications ?? [])]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byDay = useMemo(() => {
    const map = new Map<string, PublicationRow[]>();
    for (const pub of publications) {
      const dateStr = pub.status === "PUBLISHED" ? pub.published_at : pub.scheduled_at;
      if (!dateStr) continue;
      const key = dayKey(new Date(dateStr));
      const list = map.get(key) ?? [];
      list.push(pub);
      map.set(key, list);
    }
    return map;
  }, [publications]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells: (Date | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const openPreview = async (id: string) => {
    setSelectedId(id);
    setPreview(null);
    setLoadingPreview(true);
    try {
      const res = await authedFetch(`/api/social-media/publications/${id}`);
      const data = await res.json();
      if (res.ok) setPreview(data);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCancelSchedule = async () => {
    if (!selectedId) return;
    setCancelling(true);
    try {
      const res = await authedFetch(`/api/social-media/publications/${selectedId}/cancel-schedule`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Falha ao cancelar agendamento", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Agendamento cancelado" });
      setSelectedId(null);
      await load();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Calendário</h1>
          <p className="text-sm text-muted-foreground">Publicações agendadas e já publicadas.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium w-40 text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-2">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-12">Carregando...</p>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {w}
                </div>
              ))}
              {cells.map((date, i) => {
                const items = date ? (byDay.get(dayKey(date)) ?? []) : [];
                const isToday = date && dayKey(date) === dayKey(today);
                return (
                  <div
                    key={i}
                    className={cn("min-h-[92px] rounded-md border p-1.5 text-left", !date && "border-transparent bg-transparent", isToday && "border-primary")}
                  >
                    {date && (
                      <>
                        <div className={cn("text-xs mb-1", isToday ? "font-bold text-primary" : "text-muted-foreground")}>{date.getDate()}</div>
                        <div className="space-y-0.5">
                          {items.slice(0, 3).map((pub) => (
                            <button
                              key={pub.id}
                              onClick={() => openPreview(pub.id)}
                              className={cn(
                                "w-full text-left text-[10px] px-1 py-0.5 rounded truncate block",
                                pub.status === "PUBLISHED" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                              )}
                            >
                              {pub.platform}
                            </button>
                          ))}
                          {items.length > 3 && <div className="text-[10px] text-muted-foreground px-1">+{items.length - 3}</div>}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-100 border border-blue-300" /> Agendado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-green-100 border border-green-300" /> Publicado
        </span>
      </div>

      <Dialog open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes da publicação</DialogTitle>
          </DialogHeader>
          {loadingPreview || !preview ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="h-16 w-16 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  {preview.video.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview.video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <VideoIcon className="h-5 w-5 opacity-40" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{preview.video.filename}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary">{preview.publication.platform}</Badge>
                    <Badge variant="outline">{preview.publication.status}</Badge>
                  </div>
                </div>
              </div>

              {preview.content && (
                <div className="text-sm space-y-1">
                  <p className="font-medium">{preview.content.title}</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">{preview.content.caption}</p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {preview.publication.status === "PUBLISHED"
                  ? `Publicado em ${preview.publication.published_at ? new Date(preview.publication.published_at).toLocaleString("pt-BR") : "—"}`
                  : `Agendado para ${preview.publication.scheduled_at ? new Date(preview.publication.scheduled_at).toLocaleString("pt-BR") : "—"}`}
              </p>

              {preview.publication.permalink && (
                <a href={preview.publication.permalink} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline block">
                  Ver publicação →
                </a>
              )}

              {preview.publication.status === "SCHEDULED" && (
                <Button variant="destructive" size="sm" onClick={handleCancelSchedule} disabled={cancelling}>
                  {cancelling ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                  Cancelar agendamento
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
