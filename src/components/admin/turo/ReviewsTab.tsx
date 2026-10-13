import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, MessageSquare } from "lucide-react";
import { TuroExtras, EmptyExtra, epochToDate, fmtDateTime } from "./shared";

type Review = {
  text?: string | null;
  overallRating?: number;
  author?: { name?: string; firstName?: string; lastName?: string };
  created?: number;
  tripEnd?: number;
  vehicle?: { make?: string; model?: string; year?: number };
  feedbackReply?: { text?: string } | string | null;
};
type ReviewsBlob = { items?: Review[]; totalItems?: number };

type Bucket = { count?: number; score?: number };
type Scorecard = {
  scorecardTitle?: { label?: string; value?: string };
  ratingAndMetric?: { averageRating?: number; ratingCount?: number; histogram?: { buckets?: Bucket[] } };
};
type FeedbackBlob = { scorecards?: Scorecard[] };

const CAT_PT: Record<string, string> = {
  OVERALL: "Geral", MAINTENANCE: "Manutenção", CLEANLINESS: "Limpeza",
  COMMUNICATION: "Comunicação", CONVENIENCE: "Conveniência", ACCURACY: "Precisão", LISTING_ACCURACY: "Precisão",
};

function authorName(r: Review): string {
  return r.author?.name || [r.author?.firstName, r.author?.lastName].filter(Boolean).join(" ") || "Hóspede";
}
function vehicleName(r: Review): string {
  const v = r.vehicle;
  return v ? [v.year, v.make, v.model].filter(Boolean).join(" ") : "";
}
function replyText(r: Review): string | null {
  if (!r.feedbackReply) return null;
  return typeof r.feedbackReply === "string" ? r.feedbackReply : r.feedbackReply.text ?? null;
}
function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 45% 45%)`;
}

function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size }} className={i <= Math.round(n) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"} />
      ))}
    </span>
  );
}

export function ReviewsTab({ extras }: { extras: TuroExtras | null }) {
  const reviews = extras?.reviews as ReviewsBlob | null;
  const feedback = extras?.feedback as FeedbackBlob | null;
  const items = reviews?.items ?? [];
  const scorecards = feedback?.scorecards ?? [];
  const overall = scorecards.find((s) => s.scorecardTitle?.value === "OVERALL");

  if (items.length === 0 && scorecards.length === 0) return <EmptyExtra label="Avaliações" />;

  const avg = overall?.ratingAndMetric?.averageRating ?? null;
  const ratingCount = overall?.ratingAndMetric?.ratingCount ?? reviews?.totalItems ?? items.length;
  const buckets = (overall?.ratingAndMetric?.histogram?.buckets ?? []).filter((b) => (b.score ?? 0) >= 1);
  const bucketMax = Math.max(1, ...buckets.map((b) => b.count ?? 0));
  const categories = scorecards.filter((s) => s.scorecardTitle?.value !== "OVERALL");

  return (
    <div className="space-y-4">
      {extras?.syncedAt && <p className="text-xs text-muted-foreground">Capturado em {fmtDateTime(extras.syncedAt)}</p>}

      {/* Hero: overall rating + histogram */}
      {overall && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-1">
            <CardContent className="pt-6 flex flex-col items-center justify-center text-center h-full">
              <p className="text-5xl font-bold tabular-nums">{avg?.toFixed(2) ?? "—"}</p>
              {avg != null && <div className="mt-1"><Stars n={avg} size={18} /></div>}
              <p className="text-xs text-muted-foreground mt-1">{ratingCount} avaliações</p>
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold">Distribuição de notas</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const b = buckets.find((x) => x.score === star);
                const count = b?.count ?? 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="w-8 text-muted-foreground tabular-nums">{star}★</span>
                    <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-yellow-400" style={{ width: `${(count / bucketMax) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right tabular-nums text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category scorecards */}
      {categories.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {categories.map((s) => {
            const label = CAT_PT[s.scorecardTitle?.value ?? ""] ?? s.scorecardTitle?.label ?? "—";
            const r = s.ratingAndMetric?.averageRating;
            return (
              <div key={s.scorecardTitle?.value} className="rounded-xl border bg-card p-3">
                <p className="text-xs text-muted-foreground truncate">{label}</p>
                <p className="text-xl font-bold tabular-nums">{r != null ? r.toFixed(2) : "—"}</p>
                {r != null && <Stars n={r} size={11} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Reviews list */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((r, i) => {
            const name = authorName(r);
            const reply = replyText(r);
            return (
              <Card key={i}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0" style={{ background: avatarColor(name) }}>
                      {initials(name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm truncate">{name}</span>
                        {r.overallRating != null && <Stars n={r.overallRating} />}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {vehicleName(r)}{vehicleName(r) && r.tripEnd ? " · " : ""}{r.tripEnd ? epochToDate(r.tripEnd) : ""}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm">{r.text?.trim() ? r.text : <span className="text-muted-foreground italic">Sem comentário escrito</span>}</p>
                  {reply && (
                    <div className="flex gap-2 text-xs bg-muted/50 rounded-lg p-2">
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                      <p><span className="font-medium">Sua resposta:</span> {reply}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
