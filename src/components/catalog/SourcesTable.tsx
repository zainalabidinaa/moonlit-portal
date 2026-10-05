import { useEffect, useState } from 'react';
import type { Folder, FolderSource, FolderCatalog, InstalledAddon } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CatalogSourceEditor } from './CatalogSourceEditor';
import { AddSourceDialog } from './AddSourceDialog';
import type { NativeSourceRow } from '../../lib/addSource';
import { classifyCatalogId, KIND_LABEL } from '../../lib/catalogSources';
import { SourceRowTitle, useListNames } from './SourceRowTitle';

interface Props {
  folder: Folder;
  sources: FolderSource[];
  catalogs: FolderCatalog[];
  onAddSource: (provider: string) => Promise<void>;
  onDeleteSource: (id: string) => Promise<void>;
  onAddCatalog: (catalogId: string, mediaType: string, genre: string | null, addonId: string | null) => Promise<void>;
  onDeleteCatalog: (id: string) => Promise<void>;
  addons?: InstalledAddon[];
  onAddNativeSource: (row: NativeSourceRow) => Promise<void>;
  /** 'personal' is a Studio user's own collection: no add-ons and no raw
   *  provider ids, only the four source types in the Add source picker. */
  mode?: 'admin' | 'personal';
  /** Saves a source's hub row title / portrait. Omit to hide those fields. */
  onUpdateCatalog?: (id: string, patch: Partial<Pick<FolderCatalog, 'title' | 'person_tmdb_id'>>) => Promise<void>;
  /** Renames the folder. Omit to show the name read-only. */
  onRenameFolder?: (name: string) => Promise<void>;
}

export function SourcesTable({ folder, sources, catalogs, onAddSource, onDeleteSource, onAddCatalog, onDeleteCatalog, addons, onAddNativeSource, mode = 'admin', onUpdateCatalog, onRenameFolder }: Props) {
  const [provider, setProvider] = useState('');
  const [folderName, setFolderName] = useState(folder.name);
  useEffect(() => { setFolderName(folder.name); }, [folder.id, folder.name]);
  const listNames = useListNames(catalogs.map((c) => c.catalog_id));
  const [addingSource, setAddingSource] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showAddonCopy, setShowAddonCopy] = useState(false);

  async function handleAddSource() {
    if (!provider.trim()) return;
    setAddingSource(true);
    await onAddSource(provider.trim());
    setProvider('');
    setAddingSource(false);
  }

  return (
    <div className="flex flex-col gap-8">
      {onRenameFolder ? (
        <div className="-mb-3">
          <label htmlFor="folder-name" className="font-mono text-[11px] uppercase tracking-widest text-accent">Folder name</label>
          <input
            id="folder-name"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onBlur={() => { const next = folderName.trim(); if (next && next !== folder.name) onRenameFolder(next); else setFolderName(folder.name); }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="mt-1 block w-full max-w-md rounded-lg border border-border bg-bg2 px-3 py-2 text-[14px] text-text outline-none focus:border-accent"
          />
          <p className="mt-1 text-[11px] text-faint">Shown on the app&apos;s tile and as the hub title. Renaming it here renames it everywhere.</p>
        </div>
      ) : (
        <p className="font-mono text-[11px] uppercase tracking-widest text-accent -mb-4">Folder · {folder.name}</p>
      )}

      {/* ── Sources ── */}
      <div>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-text">
              Sources
              <span className="font-mono text-[10px] text-faint ml-2">folder_catalogs · {catalogs.length}</span>
            </h3>
            <p className="text-xs text-muted mt-0.5">Where this folder&apos;s content comes from.</p>
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)}>+ Add source</Button>
        </div>

        {catalogs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-8 text-center font-mono text-xs text-faint">
            No sources yet
          </div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              {catalogs.map((c) => {
                const kind = c.filter_params
                  ? 'TMDB filter'
                  : c.catalog_id.startsWith('tmdb.') || c.catalog_id.startsWith('trakt.') || c.catalog_id.startsWith('mdblist.')
                    ? KIND_LABEL[classifyCatalogId(c.catalog_id, false, false)]
                    : 'Copy';
                return (
                  <tr key={c.id} className="border-b border-border hover:bg-surface-2">
                    <td className="p-3 text-text">
                      {kind}
                      {c.genre ? <span className="text-muted"> · {c.genre}</span> : null}
                    </td>
                    <td className="p-3 font-mono text-[12px] text-muted">{c.catalog_id}</td>
                    {onUpdateCatalog && (
                      <td className="w-[38%] p-3 align-top">
                        <SourceRowTitle
                          catalog={c}
                          listName={listNames[c.catalog_id]}
                          onSave={(patch) => onUpdateCatalog(c.id, patch)}
                        />
                      </td>
                    )}
                    <td className="p-3">
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${
                        c.media_type === 'movie' ? 'bg-cyan/10 text-cyan' : 'bg-magenta/10 text-magenta'
                      }`}>{c.media_type}</span>
                    </td>
                    <td className="p-3 text-right">
                      <button onClick={() => onDeleteCatalog(c.id)} className="font-mono text-[11px] text-faint hover:text-red-400">remove</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {mode === 'admin' && (
        <div className="mt-3">
          <button
            onClick={() => setShowAddonCopy((v) => !v)}
            className="font-mono text-[11px] text-faint hover:text-text"
          >
            {showAddonCopy ? '− Hide' : '+'} Admin: copy a list from an add-on
          </button>
          {showAddonCopy && (
            <div className="mt-3 rounded-2xl border border-border p-4">
              <CatalogSourceEditor
                catalogs={catalogs}
                onAdd={onAddCatalog}
                onDelete={onDeleteCatalog}
                addons={addons}
              />
            </div>
          )}
        </div>
        )}
      </div>

      <AddSourceDialog
        open={showAdd}
        folderName={folder.name}
        onClose={() => setShowAdd(false)}
        onAdd={onAddNativeSource}
      />

      {/* ── Provider/TMDB sources ── */}
      {mode === 'admin' && (
      <div>
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-text">
              Provider sources
              <span className="font-mono text-[10px] text-faint ml-2">folder_sources · {sources.length}</span>
            </h3>
            <p className="text-xs text-muted mt-0.5">TMDB / custom provider rows.</p>
          </div>
          <div className="flex flex-none items-center gap-2">
            <Input
              id="new-source"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
              placeholder="Provider / catalog id"
              className="w-48"
            />
            <Button size="sm" loading={addingSource} onClick={handleAddSource}>+ Add</Button>
          </div>
        </div>

        {sources.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-8 text-center font-mono text-xs text-faint">
            No provider sources yet
          </div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wide text-faint">
                <th className="p-3 text-left text-[11.5px] font-semibold uppercase tracking-[.06em] text-muted">Title</th>
                <th className="p-3 text-left text-[11.5px] font-semibold uppercase tracking-[.06em] text-muted">Provider</th>
                <th className="p-3 text-left text-[11.5px] font-semibold uppercase tracking-[.06em] text-muted">TMDB id</th>
                <th className="p-3 text-left text-[11.5px] font-semibold uppercase tracking-[.06em] text-muted">Type</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-b border-border hover:bg-surface-2">
                  <td className="p-3 font-medium text-text">{s.title ?? '—'}</td>
                  <td className="p-3 font-mono text-[12px] text-muted">{s.provider}</td>
                  <td className="p-3 font-mono text-[12px] text-muted">{s.tmdb_id ?? '—'}</td>
                  <td className="p-3">
                    {s.media_type && (
                      <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${
                        s.media_type === 'movie' ? 'bg-cyan/10 text-cyan' : 'bg-magenta/10 text-magenta'
                      }`}>{s.media_type}</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => onDeleteSource(s.id)} className="font-mono text-[11px] text-faint hover:text-red-400">remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}
    </div>
  );
}
