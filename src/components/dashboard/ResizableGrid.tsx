"use client";

import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripHorizontal, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export type GridWidget = {
  id: string;
  node: ReactNode;
  /** Width in columns (1-12). Rows always fill the full width: leftover space is shared between the cards of the row. */
  w: number;
  minW?: number;
  /** Smallest height in px when the user resizes the card */
  minH?: number;
};

/** h is in px; undefined means "fit the content" (the default). */
type Item = { id: string; w: number; h?: number };

const COLS = 12;
const GAP = 16;
const MAX_H = 1800;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const ExplicitHeight = createContext(false);

/** True when the user gave this card a fixed height (its content then fills and scrolls); false when it fits its content. */
export const useExplicitHeight = () => useContext(ExplicitHeight);

/**
 * Wrapper for charts: a fixed starting height while the card fits its content, fills the card once the user resizes it.
 * `phoneHeight` (optional) is the height used below `md`, where cards always fit their content.
 */
export function ChartBox({ height = 240, phoneHeight, className, children }: { height?: number; phoneHeight?: number; className?: string; children: ReactNode }) {
  const explicit = useExplicitHeight();
  const style = explicit ? undefined : ({ height, ...(phoneHeight ? { "--ph": `${phoneHeight}px` } : {}) } as CSSProperties);
  return (
    <div className={cn(explicit ? "min-h-[120px] flex-1" : "shrink-0", !explicit && phoneHeight && "max-md:h-[var(--ph)]!", className)} style={style}>
      {children}
    </div>
  );
}

/** Long lists: capped height with scroll while the card fits its content, fills and scrolls once the card has a fixed height. */
export function ScrollBox({ maxHeight = 440, className, children }: { maxHeight?: number; className?: string; children: ReactNode }) {
  const explicit = useExplicitHeight();
  return (
    <div className={cn("overflow-auto", explicit && "min-h-0 flex-1", className)} style={explicit ? undefined : { maxHeight }}>
      {children}
    </div>
  );
}

function loadLayout(storageKey: string, legacyKeys: string[], widgets: GridWidget[]): Item[] {
  const defaults: Item[] = widgets.map((w) => ({ id: w.id, w: w.w }));
  const byId = new Map(defaults.map((d) => [d.id, d]));
  const read = (key: string, keepHeight: boolean): Item[] | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const saved = JSON.parse(raw) as { id: string; w: number; h?: number }[];
      return saved
        .filter((s) => byId.has(s.id) && Number.isFinite(s.w))
        .map((s) => ({ id: s.id, w: clamp(s.w, 1, COLS), h: keepHeight && typeof s.h === "number" ? clamp(s.h, 60, MAX_H) : undefined }));
    } catch {
      return null;
    }
  };
  // Older layouts stored heights in grid rows; keep their order and widths but let the heights fit the content.
  const saved = read(storageKey, true) ?? legacyKeys.map((k) => read(k, false)).find(Boolean) ?? null;
  if (!saved) return defaults;
  const keptIds = new Set(saved.map((k) => k.id));
  return [...saved, ...defaults.filter((d) => !keptIds.has(d.id))];
}

function GridItem({ item, widget, onResize, phone }: { item: Item; widget: GridWidget; onResize: (id: string, w: number, h: number | undefined) => void; phone: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const elRef = useRef<HTMLDivElement | null>(null);
  const [resizing, setResizing] = useState(false);
  const minW = widget.minW ?? 3;
  const minH = widget.minH ?? 140;
  // Phones stack the cards in one column and ignore saved heights: every card fits its content there.
  const fixedHeight = item.h !== undefined && !phone;

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    "--w": item.w,
    "--basis": `calc(${item.w} / 12 * 100% - ${GAP}px * (1 - ${item.w} / 12))`,
    minHeight: fixedHeight ? item.h : undefined,
    alignSelf: fixedHeight ? "stretch" : "flex-start",
  } as CSSProperties;

  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const el = elRef.current;
    const grid = el?.parentElement;
    if (!el || !grid) return;
    const rect = el.getBoundingClientRect();
    const colW = (grid.clientWidth - GAP * (COLS - 1)) / COLS;
    const sx = e.clientX;
    const sy = e.clientY;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    setResizing(true);
    const move = (ev: PointerEvent) => {
      const w = clamp(Math.round((rect.width + ev.clientX - sx + GAP) / (colW + GAP)), minW, COLS);
      // Only fix the height once the pointer really moved vertically, so a sideways drag keeps "fit content".
      const dy = ev.clientY - sy;
      const h = Math.abs(dy) > 8 || fixedHeight ? clamp(Math.round((rect.height + dy) / 8) * 8, minH, MAX_H) : undefined;
      onResize(item.id, w, h);
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
      setResizing(false);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  };

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        elRef.current = el;
      }}
      style={style}
      className={cn(
        "group/w relative flex min-w-0 basis-full md:[flex-basis:var(--basis)] md:[flex-grow:var(--w)]",
        isDragging && "opacity-80 shadow-2xl",
        resizing && "select-none",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Mover card"
        title="Arrastar para mover"
        className="absolute left-1/2 top-1 z-10 hidden -translate-x-1/2 cursor-grab touch-none rounded-full bg-background/90 px-2 py-0.5 text-muted-foreground opacity-0 shadow-sm ring-1 ring-border transition-opacity hover:text-foreground focus-visible:opacity-100 active:cursor-grabbing group-hover/w:opacity-100 md:block"
      >
        <GripHorizontal className="h-4 w-4" />
      </button>
      <ExplicitHeight.Provider value={fixedHeight}>
        <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col [&>*]:min-h-0 [&>*]:flex-1", resizing && "pointer-events-none")}>{widget.node}</div>
      </ExplicitHeight.Provider>
      <div
        onPointerDown={startResize}
        onDoubleClick={() => onResize(item.id, item.w, undefined)}
        title="Arrastar para redimensionar · duplo clique volta a altura automática"
        className="absolute bottom-0 right-0 z-10 hidden h-6 w-6 cursor-nwse-resize touch-none items-end justify-end p-1 opacity-0 transition-opacity group-hover/w:opacity-100 md:flex"
      >
        <svg viewBox="0 0 10 10" className="h-3 w-3 text-muted-foreground" aria-hidden="true">
          <path d="M9 1 1 9M9 5 5 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        </svg>
      </div>
      {resizing && <div className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-primary/40" />}
    </div>
  );
}

/**
 * Flexible dashboard grid: every card can be dragged (handle at the top, on hover) and resized (corner, on hover).
 * Widths snap to 12 columns and rows always fill the whole width. Heights fit the content until a card is resized
 * vertically; double-click the corner to give it the automatic height back. Layout persists in localStorage. On phones
 * the cards stack in one column, saved heights are ignored and the move/resize handles are hidden.
 */
export function ResizableGrid({ widgets, storageKey, legacyKeys = [] }: { widgets: GridWidget[]; storageKey: string; legacyKeys?: string[] }) {
  const phone = useIsMobile();
  const [layout, setLayout] = useState<Item[]>(() => loadLayout(storageKey, legacyKeys, widgets));

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(layout));
    } catch {
      /* ignore */
    }
  }, [layout, storageKey]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setLayout((prev) => arrayMove(prev, prev.findIndex((i) => i.id === active.id), prev.findIndex((i) => i.id === over.id)));
  };

  const onResize = (id: string, w: number, h: number | undefined) =>
    setLayout((prev) => (prev.some((i) => i.id === id && i.w === w && i.h === h) ? prev : prev.map((i) => (i.id === id ? { ...i, w, h } : i))));

  const reset = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setLayout(widgets.map((w) => ({ id: w.id, w: w.w })));
  };

  const widgetById = new Map(widgets.map((w) => [w.id, w]));
  const items = layout.filter((i) => widgetById.has(i.id));

  return (
    <div className="space-y-2">
      <div className="hidden items-center justify-end gap-3 text-xs text-muted-foreground md:flex">
        <span>Passe o mouse num card: a alça no topo move, o canto inferior direito redimensiona (duplo clique = altura automática).</span>
        <button type="button" onClick={reset} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 hover:bg-muted hover:text-foreground">
          <RotateCcw className="h-3 w-3" /> Restaurar layout
        </button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="flex flex-wrap gap-4 max-md:gap-3">
            {items.map((item) => (
              <GridItem key={item.id} item={item} widget={widgetById.get(item.id)!} onResize={onResize} phone={phone} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
