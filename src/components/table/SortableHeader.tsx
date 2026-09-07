import * as React from 'react';
import { TableHead } from '@/components/ui/table';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortableHeaderProps {
  id: string;
  className?: string;
  children: React.ReactNode;
}

export function SortableHeader({ id, className, children }: SortableHeaderProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <TableHead ref={setNodeRef} style={style} className={`bg-card ${className || ''}`}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-muted-foreground font-bold hover:text-foreground touch-none"
          {...attributes}
          {...listeners}
          aria-label="Arrastar coluna"
        >
          <GripVertical className="h-3 w-3" />
        </button>
        {children}
      </div>
    </TableHead>
  );
}
