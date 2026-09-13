import { useState } from 'react';
import { Button } from '../ui/Button';
import type { Folder } from '../../types';

interface Props {
  /** The collection's name — shown as the dialog title. */
  title: string;
  /** The collection's root folders, in display order. */
  folders: Folder[];
  /** Currently chosen folder ids. `null`/empty = all folders. */
  selectedIds: string[] | null;
  onClose: () => void;
  /** `null` means "all folders" — kept distinct from an explicit every-id
   *  list so a folder added to the collection later is included by default. */
  onApply: (ids: string[] | null) => void;
}

/**
 * "Folders" picker for a preset widget — picks all or a few of a
 * collection's root folders. The same selection drives both presentation
 * modes: in Folders mode it limits the hub tiles, in Rows mode it decides
 * which folders become their own content row. Applied per preset item, never
 * to the collection itself.
 */
export function FolderPickerDialog({ title, folders, selectedIds, onClose, onApply }: Props) {
  const allIds = folders.map((f) => f.id);
  const explicitlySet = selectedIds != null && selectedIds.length > 0;
  const [selected, setSelected] = useState<Set<string>>(
    new Set(explicitlySet ? allIds.filter((id) => selectedIds!.includes(id)) : allIds),
  );

  const selectedCount = selected.size;
  const countLabel = selectedCount === allIds.length ? `All ${allIds.length}` : `${selectedCount} of ${allIds.length}`;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function apply() {
    // "All selected" is stored as NULL so folders added later are included —
    // the same convention the app reads for pre-migration rows.
    onApply(selectedCount === allIds.length ? null : allIds.filter((id) => selected.has(id)));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5">
      <div className="flex max-h-[88vh] w-[520px] max-w-full flex-col overflow-hidden rounded-2xl border border-border-strong bg-surface">
        <div className="flex items-center border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-text">{title} — folders</h2>
          <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            {folders.length} folder{folders.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex flex-col gap-3 overflow-auto px-5 py-4">
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="flex items-center justify-between bg-surface-2 px-3.5 py-2.5 text-sm text-muted">
              <span>
                <b className="text-text">{countLabel}</b> selected
              </span>
              <span className="flex gap-3 text-xs font-semibold text-accent">
                <button className="hover:underline" onClick={() => setSelected(new Set(allIds))}>Select all</button>
                <button className="hover:underline" onClick={() => setSelected(new Set())}>Select none</button>
              </span>
            </div>
            <div className="max-h-[46vh] overflow-auto">
              {folders.map((folder) => {
                const on = selected.has(folder.id);
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => toggle(folder.id)}
                    className={`flex w-full items-center gap-3 border-t border-border px-3.5 py-2 text-left text-sm transition-opacity ${on ? '' : 'opacity-50'}`}
                  >
                    <span className={`relative h-5 w-9 flex-none rounded-full transition-colors ${on ? 'bg-accent' : 'border border-border bg-surface-2'}`}>
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
                    </span>
                    <span className="truncate text-text">{folder.name}</span>
                  </button>
                );
              })}
              {folders.length === 0 && (
                <div className="border-t border-border px-3.5 py-3 text-sm text-faint">
                  This collection has no folders yet.
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-faint">
            Applies to both modes — the same choice limits the folder tiles and decides which folders
            become content rows. At least one folder is required.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={apply} disabled={selectedCount === 0}>Apply</Button>
        </div>
      </div>
    </div>
  );
}
