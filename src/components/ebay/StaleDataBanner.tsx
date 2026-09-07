import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldQuestion } from "lucide-react";

/** Shown instead of (or above) a report when its data came from ebay_report_cache
 *  because the live eBay call just failed — so the page shows the last known-good
 *  numbers instead of going blank, with a clear "this isn't live" timestamp. */
export function StaleDataBanner({ fetchedAt }: { fetchedAt: string | null }) {
  return (
    <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
      <ShieldQuestion className="h-4 w-4" />
      <AlertDescription>
        Conexão com o eBay indisponível no momento — mostrando os últimos dados obtidos
        {fetchedAt ? ` em ${new Date(fetchedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}.
      </AlertDescription>
    </Alert>
  );
}
