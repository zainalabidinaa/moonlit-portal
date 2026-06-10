import { DragHandle } from '../ui/DragHandle';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { Collection } from '../../types';

interface CollectionRowProps {
  collection: Collection;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}

export function CollectionRow({ collection, onEdit, onDelete, onDragStart, onDrop }: CollectionRowProps) {
  return (
    <div
      className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3 cursor-default"
      draggable
      onDragStart={onDragStart}
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
    >
      <DragHandle />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text truncate">{collection.name}</p>
        {collection.pin_to_top && <Badge variant="purple">Pinned</Badge>}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={onEdit}>Edit</Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>Delete</Button>
      </div>
    </div>
  );
}
