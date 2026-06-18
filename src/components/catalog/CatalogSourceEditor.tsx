import { useMemo, useState } from 'react';
import type { FolderCatalog } from '../../types';
import { useAddonManifest, AIO_MANIFEST_URL } from '../../hooks/useAddonManifest';
import { Button } from '../ui/Button';

interface Props {
  catalogs: FolderCatalog[];
  onAdd: (catalogId: string, mediaType: string, genre: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function CatalogSourceEditor({ catalogs, onAdd, onDelete }: Props) {
  const { manifest, loading, error, hasUpdate, refresh, catalogById } = useAddonManifest(AIO_MANIFEST_URL);

  const [search, setSearch] = useState('');
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [adding, setAdding] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const selectedCatalog = manifest?.catalogs.find((c) => c.id === selectedCatalogId) ?? null;

  const filteredCatalogs = useMemo(() => {
    if (!manifest) return [];
    const q = search.toLowerCase();
    return manifest.catalogs.filter(
      (c) => !q || c.name.toLowerCase().includes(q) || c.type.includes(q) || c.id.includes(q),
    );
  }, [manifest, search]);

  async function handleAdd() {
    if (!selectedCatalogId || !selectedCatalog) return;
    const genreRequired = selectedCatalog.genreRequired;
    if (genreRequired && !selectedGenre) return;
    setAdding(true);
    await onAdd(selectedCatalogId, selectedCatalog.type, selectedGenre || null);
    setSelectedCatalogId('');
    setSelectedGenre('');
    setSearch('');
    setShowPicker(false);
    setAdding(false);
  }

  return (
    <div>
      {/* header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="rounded-full border border-accent/40 bg-accent-light px-3 py-1 font-mono text-[11px] font-semibold text-accent">
            AIOMetadata
          </span>
          {loading && <span className="font-mono text-[11px] text-faint animate-pulse">Loading manifest…</span>}
          {error && <span className="font-mono text-[11px] text-red-400">Manifest error: {error}</span>}
          {!loading && manifest && (
            <span className="font-mono text-[11px] text-faint">
              {manifest.catalogCount} catalogs · refreshed {manifest.fetchedAt.toLocaleTimeString()}
            </span>
          )}
          {hasUpdate && (
            <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] font-bold text-[#2a1206]">
              UPDATED
            </span>
          )}
        </div>
        <button
          onClick={refresh}
          className="font-mono text-[11px] text-faint hover:text-accent transition-colors"
          title="Re-fetch manifest now"
        >
          ↺ refresh
        </button>
      </div>

      {/* existing catalog entries */}
      {catalogs.length > 0 && (
        <div className="mb-4 grid gap-2">
          {catalogs.map((c) => {
            const meta = catalogById(c.catalog_id);
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-text truncate">
                    {meta?.name ?? c.catalog_id}
                  </p>
                  <p className="font-mono text-[10px] text-faint">{c.catalog_id}</p>
                </div>
                <div className="flex items-center gap-2 flex-none">
                  <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${
                    c.media_type === 'movie' ? 'bg-cyan/10 text-cyan' :
                    c.media_type === 'series' ? 'bg-magenta/10 text-magenta' :
                    'bg-accent/10 text-accent'
                  }`}>{c.media_type}</span>
                  {c.genre && (
                    <span className="rounded px-1.5 py-0.5 font-mono text-[9px] bg-surface border border-border text-muted">
                      {c.genre}
                    </span>
                  )}
                  <button
                    onClick={() => onDelete(c.id)}
                    className="ml-1 font-mono text-[11px] text-faint hover:text-red-400 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* add new */}
      {!showPicker ? (
        <button
          onClick={() => setShowPicker(true)}
          disabled={loading || !!error}
          className="w-full rounded-2xl border border-dashed border-border py-4 text-sm text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
        >
          + Add catalog source
        </button>
      ) : (
        <div className="rounded-2xl border border-accent/20 bg-surface-2 p-4">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted">Select catalog</p>

          {/* search */}
          <input
            type="text"
            placeholder="Search 1174 catalogs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2 w-full rounded-xl border border-border bg-bg px-3 py-2 font-mono text-[12px] text-text outline-none focus:border-accent placeholder:text-faint"
          />

          {/* catalog list */}
          <div className="mb-3 h-52 overflow-y-auto rounded-xl border border-border bg-bg">
            {filteredCatalogs.length === 0 ? (
              <p className="py-6 text-center font-mono text-[11px] text-faint">No catalogs match</p>
            ) : (
              filteredCatalogs.map((c) => (
                <button
                  key={`${c.type}:${c.id}`}
                  onClick={() => { setSelectedCatalogId(c.id); setSelectedGenre(''); }}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-2 ${
                    selectedCatalogId === c.id ? 'bg-accent-light' : ''
                  }`}
                >
                  <span className={`flex-none rounded px-1.5 py-0.5 font-mono text-[9px] uppercase ${
                    c.type === 'movie' ? 'bg-cyan/10 text-cyan' :
                    c.type === 'series' ? 'bg-magenta/10 text-magenta' :
                    'bg-accent/10 text-accent'
                  }`}>{c.type}</span>
                  <span className="flex-1 truncate text-[12px] text-text">{c.name}</span>
                  {selectedCatalogId === c.id && <span className="text-accent text-xs">✓</span>}
                </button>
              ))
            )}
          </div>

          {/* genre filter — shown only when catalog is selected and has genres */}
          {selectedCatalog && selectedCatalog.genres.length > 0 && (
            <div className="mb-3">
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-muted">
                Genre filter{selectedCatalog.genreRequired ? ' (required)' : ''}
              </label>
              <select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg px-3 py-2 font-mono text-[12px] text-text outline-none focus:border-accent"
              >
                <option value="">None</option>
                {[...selectedCatalog.genres].sort().map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              {selectedCatalog.genreRequired && !selectedGenre && (
                <p className="mt-1 font-mono text-[10px] text-red-400">This catalog requires a genre selection</p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              loading={adding}
              disabled={!selectedCatalogId || (selectedCatalog?.genreRequired && !selectedGenre)}
              onClick={handleAdd}
            >
              Add source
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowPicker(false); setSearch(''); setSelectedCatalogId(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
