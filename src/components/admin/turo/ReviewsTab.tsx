import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TuroExtras, JsonView, EmptyExtra, fmtDateTime } from "./shared";

export function ReviewsTab({ extras }: { extras: TuroExtras | null }) {
  const hasReviews = extras?.reviews != null;
  const hasFeedback = extras?.feedback != null;
  if (!hasReviews && !hasFeedback) return <EmptyExtra label="Avaliações" />;

  return (
    <div className="space-y-4">
      {extras?.syncedAt && (
        <p className="text-xs text-muted-foreground">Capturado em {fmtDateTime(extras.syncedAt)}</p>
      )}

      {hasReviews && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Avaliações dos hóspedes</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonView value={extras!.reviews} />
          </CardContent>
        </Card>
      )}

      {hasFeedback && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Feedback estruturado</CardTitle>
          </CardHeader>
          <CardContent>
            <JsonView value={extras!.feedback} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
