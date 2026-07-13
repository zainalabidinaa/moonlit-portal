import { useEffect, useRef, useState } from 'react';
import type { FolderEntry } from '../../types';

interface Props {
  entries: FolderEntry[];
  onSave: (entries: FolderEntry[]) => Promise<void>;
  onOpenFolder?: (folderId: string) => void;
  onMoveFolderToRoot?: (folderId: string) => Promise<void>;
  movableFolders?: { id: string; label: string }[];
  onMoveFolderHere?: (folderId: string) => Promise<void>;
}

function ordered(entries: FolderEntry[]) {
  return [...entries].sort((a, b) => a.sortOrder - b.sortOrder);
}

function persistable(entries: FolderEntry[]): FolderEntry[] {
  return entries.map((entry, sortOrder) => {
    if (entry.entryKind === 'folder') return { entryKind: entry.entryKind, folderId: entry.folderId, sortOrder };
    if (entry.entryKind === 'catalog') return { entryKind: entry.entryKind, folderCatalogId: entry.folderCatalogId, sortOrder };
    return { entryKind: entry.entryKind, folderSourceId: entry.folderSourceId, sortOrder };
  });
}

/** One mixed, portal-ordered list of a folder's child folders and media sources. */
export function FolderEntriesEditor({ entries, onSave, onOpenFolder, onMoveFolderToRoot, movableFolders, onMoveFolderHere }: Props) {
  const [confirmed, setConfirmed] = useState(() => ordered(entries));
  const [draft, setDraft] = useState(() => ordered(entries));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [folderToMove, setFolderToMove] = useState('');
  const dragIndex = useRef<number | null>(null);

  useEffect(() => {
    const next = ordered(entries);
    setConfirmed(next);
    setDraft(next);
  }, [entries]);

  async function reorder(to: number) {
    if (dragIndex.current === null || dragIndex.current === to) return;
    const next = [...draft];
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(to, 0, moved);
    dragIndex.current = null;
    const saved = persistable(next);
    setDraft(saved);
    setSaveError(null);
    try {
      await onSave(saved);
      setConfirmed(saved);
    } catch (error) {
      setDraft(confirmed);
      setSaveError(error instanceof Error ? error.message : 'Unable to save order');
    }
  }

  async function moveFolderHere() {
    if (!folderToMove || !onMoveFolderHere) return;
    setSaveError(null);
    try {
      await onMoveFolderHere(folderToMove);
      setFolderToMove('');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to move folder');
    }
  }

  async function moveFolderToRoot(folderId: string) {
    if (!onMoveFolderToRoot) return;
    setSaveError(null);
    try {
      await onMoveFolderToRoot(folderId);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to move folder');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-text">Folder contents</h3>
        <p className="mt-0.5 text-xs text-muted">Drag folders and media sources into the order Moonlit should display.</p>
      </div>

      {saveError && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{saveError}</p>}

      {onMoveFolderHere && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg2 p-3">
          <label htmlFor="move-folder-here" className="text-xs text-muted">Move existing folder here</label>
          <select
            id="move-folder-here"
            aria-label="Move existing folder here"
            value={folderToMove}
            onChange={(event) => setFolderToMove(event.target.value)}
            className="min-w-44 flex-1 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
          >
            <option value="">Choose a folder</option>
            {movableFolders?.map((folder) => <option key={folder.id} value={folder.id}>{folder.label}</option>)}
          </select>
          <button disabled={!folderToMove} onClick={() => void moveFolderHere()} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-[#2a1206] disabled:opacity-40">Move here</button>
        </div>
      )}

      {draft.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-8 text-center font-mono text-xs text-faint">No subfolders or sources yet</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {draft.map((entry, index) => (
            <li
              key={entryIdentity(entry)}
              draggable
              onDragStart={() => { dragIndex.current = index; }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => void reorder(index)}
              className="flex cursor-grab items-center gap-3 rounded-xl border border-border bg-bg2 px-3 py-3 active:cursor-grabbing"
            >
              <span className="font-mono text-xs text-faint">⠿</span>
              <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${entry.entryKind === 'folder' ? 'bg-accent/10 text-accent' : entry.entryKind === 'catalog' ? 'bg-cyan/10 text-cyan' : 'bg-magenta/10 text-magenta'}`}>
                {entry.entryKind}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{entry.label ?? entryIdentity(entry)}</span>
              {entry.entryKind === 'folder' && (
                <div className="flex gap-2">
                  {onOpenFolder && <button onClick={() => onOpenFolder(entry.folderId)} className="font-mono text-[11px] text-muted hover:text-accent">open</button>}
                  {onMoveFolderToRoot && <button onClick={() => void moveFolderToRoot(entry.folderId)} className="font-mono text-[11px] text-muted hover:text-accent">move to root</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function entryIdentity(entry: FolderEntry) {
  if (entry.entryKind === 'folder') return entry.folderId;
  if (entry.entryKind === 'catalog') return entry.folderCatalogId;
  return entry.folderSourceId;
}
