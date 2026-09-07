import { useEffect, useMemo, useRef, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import { authedFetch } from '@/lib/admin-fetch';

const defaultVisibility = (order: string[]) => Object.fromEntries(order.map(id => [id, true]));

// Reconciles a saved column order against the table's current default order: keep saved
// columns (dropping any that no longer exist), then append any new columns not yet saved.
function reconcileOrder(saved: string[], defaultOrder: string[]): string[] {
  const known = new Set(saved);
  return [...saved.filter(id => defaultOrder.includes(id)), ...defaultOrder.filter(id => !known.has(id))];
}

/**
 * Column order/visibility for one admin table, persisted as a SINGLE global row in the DB
 * (table_view_preferences) — shared across prod/dev/local and every device. Saving from any
 * environment overwrites the same saved view for everyone.
 *
 * On first load in a browser that still has an old localStorage copy (pre-DB-migration),
 * that copy is pushed up to the DB once (only if the DB has nothing saved yet), then
 * localStorage stops being read.
 */
export function useColumnPreferences(storageKey: string, defaultOrder: string[]) {
  const legacyOrderKey = `${storageKey}.columnOrder.v1`;
  const legacyVisKey = `${storageKey}.columnVisibility.v1`;
  const migratedKey = `${storageKey}.columnPrefs.migratedToDb.v1`;

  const [columnOrder, setColumnOrder] = useState<string[]>(defaultOrder);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(defaultVisibility(defaultOrder));

  // What's actually persisted — the draft (columnOrder/columnVisibility) only catches up to
  // this on an explicit saveView(), so "Save View" can show whether there's anything to save.
  const [savedOrder, setSavedOrder] = useState<string[]>(defaultOrder);
  const [savedVisibility, setSavedVisibility] = useState<Record<string, boolean>>(defaultVisibility(defaultOrder));

  const defaultOrderRef = useRef(defaultOrder);
  defaultOrderRef.current = defaultOrder;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // One-shot migration: legacy localStorage copy from before this table had a DB row.
      try {
        if (!localStorage.getItem(migratedKey)) {
          localStorage.setItem(migratedKey, "1");
          const legacyOrderRaw = localStorage.getItem(legacyOrderKey);
          const legacyVisRaw = localStorage.getItem(legacyVisKey);
          if (legacyOrderRaw || legacyVisRaw) {
            const res = await authedFetch(`/api/table-views?key=${encodeURIComponent(storageKey)}`);
            const existing = res.ok ? await res.json() : null;
            // Only seed the DB from localStorage if nothing is saved there yet — otherwise
            // a stale local copy could clobber the shared view someone already saved.
            if (!existing?.columnOrder) {
              const order = legacyOrderRaw ? JSON.parse(legacyOrderRaw) : defaultOrderRef.current;
              const visibility = legacyVisRaw ? JSON.parse(legacyVisRaw) : defaultVisibility(defaultOrderRef.current);
              await authedFetch("/api/table-views", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: storageKey, columnOrder: order, columnVisibility: visibility }),
              });
            }
          }
        }
      } catch { /* best-effort migration */ }

      try {
        const res = await authedFetch(`/api/table-views?key=${encodeURIComponent(storageKey)}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const order = data.columnOrder ? reconcileOrder(data.columnOrder, defaultOrderRef.current) : defaultOrderRef.current;
        const visibility = data.columnVisibility ?? defaultVisibility(defaultOrderRef.current);
        if (cancelled) return;
        setColumnOrder(order);
        setColumnVisibility(visibility);
        setSavedOrder(order);
        setSavedVisibility(visibility);
      } catch { /* keep defaults on network error */ }
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const isDirty = useMemo(() => {
    return (
      JSON.stringify(columnOrder) !== JSON.stringify(savedOrder) ||
      JSON.stringify(columnVisibility) !== JSON.stringify(savedVisibility)
    );
  }, [columnOrder, columnVisibility, savedOrder, savedVisibility]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setColumnOrder(prev => {
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  async function persist(order: string[], visibility: Record<string, boolean>) {
    await authedFetch("/api/table-views", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: storageKey, columnOrder: order, columnVisibility: visibility }),
    });
  }

  const saveView = () => {
    setSavedOrder(columnOrder);
    setSavedVisibility(columnVisibility);
    void persist(columnOrder, columnVisibility);
  };

  const reset = () => {
    const order = defaultOrderRef.current;
    const visibility = defaultVisibility(defaultOrderRef.current);
    setColumnOrder(order);
    setColumnVisibility(visibility);
    setSavedOrder(order);
    setSavedVisibility(visibility);
    void persist(order, visibility);
  };

  const visibleOrderedIds = useMemo(
    () => columnOrder.filter(id => columnVisibility[id] !== false),
    [columnOrder, columnVisibility]
  );

  return {
    columnOrder,
    columnVisibility,
    setColumnVisibility,
    handleDragEnd,
    reset,
    saveView,
    isDirty,
    visibleOrderedIds,
  };
}
