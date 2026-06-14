import { useState } from 'react';
import type { Folder, FolderSource, FolderCatalog } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CatalogSourceEditor } from './CatalogSourceEditor';

interface Props {
  folder: Folder;
  sources: FolderSource[];
  catalogs: FolderCatalog[];
  onAddSource: (provider: string) => Promise<void>;
  onDeleteSource: (id: string) => Promise<void>;
  onAddCatalog: (catalogId: string, mediaType: string, genre: string | null) => Promise<void>;
  onDeleteCatalog: (id: string) => Promise<void>;
}

export function SourcesTable({ folder, sources, catalogs, onAddSource, onDeleteSource, onAddCatalog, onDeleteCatalog }: Props) {
  const [provider, setProvider] = useState('');
  const [addingSource, setAddingSource] = useState(false);

  async function handleAddSource() {
    if (!provider.trim()) return;
    setAddingSource(true);
    await onAddSource(provider.trim());
    setProvider('');
    setAddingSource(false);
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="font-mono text-[11px] uppercase tracking-widest text-accent -mb-4">Folder · {folder.name}</p>

      {/* ── Catalog sources (AIOMetadata / Stremio) ── */}
      <div>
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-text">
            Catalog sources
            <span className="font-mono text-[10px] text-faint ml-2">folder_catalogs · {catalogs.length}</span>
          </h3>
          <p className="text-xs text-muted mt-0.5">Stremio addon catalogs — picked from the live AIOMetadata manifest.</p>
        </div>
        <CatalogSourceEditor
          catalogs={catalogs}
          onAdd={onAddCatalog}
          onDelete={onDeleteCatalog}
        />
      </div>

      {/* ── Provider/TMDB sources ── */}
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
                <th className="p-3 font-normal">Title</th>
                <th className="p-3 font-normal">Provider</th>
                <th className="p-3 font-normal">TMDB id</th>
                <th className="p-3 font-normal">Type</th>
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
    </div>
  );
}
