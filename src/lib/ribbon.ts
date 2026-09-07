/** Colors available for the product "Fita" (ribbon banner), admin-assigned. */
export const RIBBON_COLOR_OPTIONS = [
  { value: "red", label: "Vermelho", className: "bg-red-600 text-white" },
  { value: "orange", label: "Laranja", className: "bg-orange-500 text-white" },
  { value: "gold", label: "Dourado", className: "bg-amber-500 text-white" },
  { value: "green", label: "Verde", className: "bg-green-600 text-white" },
  { value: "blue", label: "Azul", className: "bg-blue-600 text-white" },
  { value: "black", label: "Preto", className: "bg-black text-white" },
  { value: "purple", label: "Roxo", className: "bg-purple-600 text-white" },
  { value: "pink", label: "Rosa", className: "bg-pink-500 text-white" },
] as const;

export function getRibbonClassName(color: string | null | undefined): string {
  return (
    RIBBON_COLOR_OPTIONS.find((o) => o.value === color)?.className ||
    "bg-gray-800 text-white"
  );
}
