import { DragHandle } from '../ui/DragHandle';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { Collection } from '../../types';

interface CollectionRowProps {
  collection: Collection;
  folderCount?: number;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDrop: () => void;
}

export function CollectionRow({ collection, folderCount, onEdit, onDelete, onDragStart, onDrop }: CollectionRowProps) {
  return (
    <div
      className="flex items-center gap-3 bg-surface border border-border rounded-xl px-3 py-3 cursor-default hover:border-accent/40 transition-colors"
      draggable
      onDragStart={onDragStart}
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
    >
      <DragHandle />

      {/* Artwork thumbnail */}
      <div className="w-14 h-10 rounded-lg overflow-hidden shrink-0 bg-surface-2 border border-border flex items-center justify-center">
        {collection.backdrop_image ? (
          <img src={collection.backdrop_image} alt="" className="w-full h-full object-cover" />
        ) : (
          <svg className="w-5 h-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-text truncate">{collection.name}</p>
          {collection.pin_to_top && <Badge variant="purple">Pinned</Badge>}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {folderCount !== undefined && (
            <span className="text-xs text-muted">{folderCount} {folderCount === 1 ? 'group' : 'groups'}</span>
          )}
          {collection.view_mode && collection.view_mode !== 'FOLLOW_LAYOUT' && (
            <span className="text-xs text-muted">{collection.view_mode}</span>
          )}
          {collection.show_all_tab && (
            <span className="text-xs text-muted">All tab</span>
          )}
        </div>
      </div>

      <div className="flex gap-2 shrink-0">
        <Button size="sm" variant="secondary" onClick={onEdit}>Edit</Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>Delete</Button>
      </div>
    </div>
  );
}
