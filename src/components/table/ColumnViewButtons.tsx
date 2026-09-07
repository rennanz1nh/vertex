import { Button } from "@/components/ui/button";
import { Save, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  isDirty: boolean;
  onSave: () => void;
  onReset: () => void;
};

/** Pair of buttons next to the "Colunas" dropdown — persists the current column
 *  order/visibility as the view shown on future visits, or reverts to the defaults.
 *  Shared across every page that uses useColumnPreferences. */
export function ColumnViewButtons({ isDirty, onSave, onReset }: Props) {
  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={onSave}
        disabled={!isDirty}
        className={cn(
          "gap-1.5",
          isDirty
            ? "bg-black text-white hover:bg-black/80"
            : "bg-gray-100 text-gray-400 hover:bg-gray-100 disabled:opacity-100"
        )}
        title={isDirty ? "Salvar a view atual" : "View já salva"}
      >
        <Save className="h-4 w-4" />
        Save View
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onReset}
        className="gap-1.5 bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100 hover:text-gray-600"
        title="Restaurar colunas padrão"
      >
        <Undo2 className="h-4 w-4" />
        Reset View
      </Button>
    </>
  );
}
