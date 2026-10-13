import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";
import { TuroExtras, JsonView, EmptyExtra, epochToDate, fmtDateTime } from "./shared";

type Review = {
  text?: string | null;
  rating?: number;
  starRating?: number;
  score?: number;
  author?: { name?: string; firstName?: string; lastName?: string; url?: string };
  created?: number;
  tripEnd?: number;
  vehicle?: { make?: string; model?: string; name?: string; year?: number };
};
type ReviewsBlob = { items?: Review[]; totalCount?: number };

function ratingOf(r: Review): number | null {
  const v = r.rating ?? r.starRating ?? r.score;
  return typeof v === "number" ? v : null;
}
function authorName(r: Review): string {
  return r.author?.name || [r.author?.firstName, r.author?.lastName].filter(Boolean).join(" ") || "Hóspede";
}
function vehicleName(r: Review): string {
  const v = r.vehicle;
  if (!v) return "";
  return [v.year, v.make, v.model].filter(Boolean).join(" ") || v.name || "";
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
      ))}
    </span>
  );
}

export function ReviewsTab({ extras }: { extras: TuroExtras | null }) {
  const reviews = extras?.reviews as ReviewsBlob | null;
  const items = reviews?.items ?? [];
  const hasFeedback = extras?.feedback != null;

  if (items.length === 0 && !hasFeedback) return <EmptyExtra label="Avaliações" />;

  const rated = items.map(ratingOf).filter((v): v is number => v != null);
  const avg = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        {avg != null && (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tabular-nums">{avg.toFixed(2)}</span>
            <Stars n={Math.round(avg)} />
          </div>
        )}
        <span className="text-sm text-muted-foreground">{items.length} avaliação(ões)</span>
        {extras?.syncedAt && <span className="text-xs text-muted-foreground ml-auto">Capturado em {fmtDateTime(extras.syncedAt)}</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((r, i) => {
          const rating = ratingOf(r);
          return (
            <Card key={i}>
              <CardContent className="pt-4 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm">{authorName(r)}</span>
                  {rating != null && <Stars n={rating} />}
                </div>
                <p className="text-xs text-muted-foreground">
                  {vehicleName(r)}{vehicleName(r) && r.tripEnd ? " · " : ""}{r.tripEnd ? epochToDate(r.tripEnd) : ""}
                </p>
                <p className="text-sm">{r.text?.trim() ? r.text : <span className="text-muted-foreground italic">Sem comentário escrito</span>}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {hasFeedback && (
        <details className="rounded-lg border p-3">
          <summary className="text-sm font-medium cursor-pointer">Feedback estruturado (bruto)</summary>
          <div className="mt-2"><JsonView value={extras!.feedback} /></div>
        </details>
      )}
    </div>
  );
}
