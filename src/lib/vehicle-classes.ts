// Shared vehicle-class labels/colors — used by the admin Calendar and Dashboard so a
// category reads the same way (same color, same label) everywhere it shows up.
export type VehicleClass = 'compact' | 'big-van' | 'luxe' | 'sport';
export const VEHICLE_CLASSES: VehicleClass[] = ['compact', 'big-van', 'luxe', 'sport'];

export const VEHICLE_CLASS_LABEL: Record<VehicleClass, string> = {
  compact: 'Compact',
  'big-van': 'Big Van',
  luxe: 'Luxe',
  sport: 'Sport',
};

export const VEHICLE_CLASS_COLOR: Record<VehicleClass, string> = {
  compact: '#1fb8c4',
  'big-van': '#7a5cf0',
  luxe: '#b8862f',
  sport: '#d1444f',
};

export const NEUTRAL_VEHICLE_COLOR = '#64748b';

export function vehicleClassOf(storeCategories: string[] | null | undefined): VehicleClass | null {
  const cats = storeCategories ?? [];
  return VEHICLE_CLASSES.find((c) => cats.includes(c)) ?? null;
}
