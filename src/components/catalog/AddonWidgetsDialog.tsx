import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import type { HomePreset } from '../../types';
import type { WidgetTab } from './WidgetGrid';
import { syncCollectionTrees, type TreeSyncResult } from '../../lib/collectionTrees';
import { fetchAddonManifest, manifestToCollectionTrees, type AddonManifestInfo } from '../../lib/addonCatalogWidgets';

interface Props {
  /** The installed add-on's manifest URL. */
  manifestUrl: string;
  /** The add-on's label, shown until the manifest's own name loads. */
  addonLabel: string;
  onClose: () => void;
  onAdded: (summary: string) => void;
}

const TABS: WidgetTab[] = ['home', 'movies', 'series'];
const TAB_LABELS: Record<WidgetTab, string> = { home: 'Home', movies: 'Movies', series: 'Series' };

/**
 * Opens after adding an add-on (or from a row's "Widgets" button): reads the
 * add-on's manifest and builds **one widget per catalog group** — the
 * manifest's own `<Provider> · <Section>` structure, where each provider
 * (elCinema, WATCH IT, …) becomes a collection whose folders are its
 * sections. Added to the chosen preset + tab, append-only and keyed by
 * stable ids, so re-running syncs the same widgets instead of duplicating.
 */
export function AddonWidgetsDialog({ manifestUrl, addonLabel, onClose, onAdded }: Props) {
  const [manifest, setManifest] = useState<AddonManifestInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');

  const [presets, setPresets] = useState<HomePreset[]>([]);
  const [presetId, setPresetId] = useState('');
  const [tab, setTab] = useState<WidgetTab>('home');
  const [startSortOrder, setStartSortOrder] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const info = await fetchAddonManifest(manifestUrl);
        if (cancelled) return;
        setManifest(info);
        setSelected(new Set(manifestToCollectionTrees(info).trees.map((_, index) => index)));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [manifestUrl]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('home_presets').select('*').order('sort_order');
      const loaded = (data as HomePreset[]) ?? [];
      setPresets(loaded);
      setPresetId((current) => current || (loaded.find((p) => p.slug === 'signature' && p.is_active) ?? loaded.find((p) => p.is_active) ?? loaded[0])?.id || '');
    })();
  }, []);

  // Append after whatever the chosen preset + tab already has.
  useEffect(() => {
    if (!presetId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('home_preset_items')
        .select('sort_order')
        .eq('preset_id', presetId)
        .eq('tab', tab)
        .order('sort_order', { ascending: false })
        .limit(1);
      if (cancelled) return;
      const max = data?.[0]?.sort_order;
      setStartSortOrder(typeof max === 'number' ? max + 1 : 0);
    })();
    return () => { cancelled = true; };
  }, [presetId, tab]);

  const groups = useMemo(() => (manifest ? manifestToCollectionTrees(manifest) : { trees: [], skipped: [] }), [manifest]);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const indexed = groups.trees.map((tree, index) => ({ tree, index }));
    if (!query) return indexed;
    return indexed.filter(({ tree }) =>
      tree.name.toLowerCase().includes(query) ||
      tree.folders.some((f) => f.name.toLowerCase().includes(query)));
  }, [groups]);

  const selectedCount = selected.size;

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function summarize(outcome: TreeSyncResult, presetName: string): string {
    const widgets = outcome.presetItemsCreated + outcome.presetItemsUpdated;
    const parts = [`${outcome.foldersCreated + outcome.foldersUpdated} sections`];
    if (outcome.foldersRemoved) parts.push(`${outcome.foldersRemoved} removed`);
    parts.push(`${outcome.sourcesWritten} sources`);
    if (outcome.presetItemsUpdated) parts.push(`${outcome.presetItemsUpdated} widget${outcome.presetItemsUpdated === 1 ? '' : 's'} updated`);
    const failure = outcome.errors.length
      ? ` — ${outcome.errors.length} failed: ${outcome.errors[0].slice(0, 220)}`
      : '';
    return `Synced ${widgets} widget${widgets === 1 ? '' : 's'} (${parts.join(', ')}) into “${presetName} · ${TAB_LABELS[tab]}”${failure}`;
  }

  async function commit() {
    if (!manifest || !presetId) return;
    const chosen = groups.trees.filter((_, index) => selected.has(index));
    if (!chosen.length) return;
    setBusy(true);
    setError(null);
    setProgress('Starting sync…');
    try {
      const outcome = await syncCollectionTrees({
        presetId,
        tab,
        trees: chosen,
        startSortOrder,
        onProgress: (message) => setProgress(message),
      });
      const presetName = presets.find((p) => p.id === presetId)?.name ?? 'preset';
      onAdded(summarize(outcome, presetName));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const title = manifest?.name ?? addonLabel;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5">
      <div className="flex max-h-[88vh] w-[640px] max-w-full flex-col overflow-hidden rounded-2xl border border-border-strong bg-surface">
        <div className="flex items-center border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-text">Addon Widgets — {title}</h2>
          {manifest && (
            <span className="ml-3 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              {groups.trees.length} widget{groups.trees.length === 1 ? '' : 's'}
            </span>
          )}
          <button onClick={onClose} className="ml-auto text-muted transition-colors hover:text-text" aria-label="Close">✕</button>
        </div>

        <div className="flex flex-col gap-3 overflow-auto px-5 py-4">
          {loading && <p className="text-sm text-muted">Reading the add-on&apos;s manifest…</p>}

          {error && <p className="text-sm text-red-400">{error}</p>}

          {manifest && groups.trees.length === 0 && (
            <p className="text-sm text-muted">This add-on declares no catalogs that can stand alone as widgets.</p>
          )}

          {manifest && groups.trees.length > 0 && (
            <>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search providers and sections…"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-faint focus:border-accent focus:outline-none"
              />

              <div className="overflow-hidden rounded-xl border border-border">
                <div className="flex items-center justify-between bg-surface-2 px-3.5 py-2.5 text-sm text-muted">
                  <span>
                    <b className="text-text">{selectedCount}</b> of <b className="text-text">{groups.trees.length}</b> widgets selected
                  </span>
                  <span className="flex gap-3 text-xs font-semibold text-accent">
                    <button className="hover:underline" onClick={() => setSelected(new Set(groups.trees.map((_, i) => i)))}>Select all</button>
                    <button className="hover:underline" onClick={() => setSelected(new Set())}>Select none</button>
                  </span>
                </div>
                <div className="max-h-56 overflow-auto">
                  {visible.map(({ tree, index }) => {
                    const on = selected.has(index);
                    const firstSource = tree.folders[0]?.sources[0];
                    const kindLabel = firstSource?.kind === 'catalog' ? firstSource.mediaType : 'mixed';
                    return (
                      <button
                        key={tree.externalId}
                        type="button"
                        onClick={() => toggle(index)}
                        className={`flex w-full items-center gap-3 border-t border-border px-3.5 py-2 text-left text-sm transition-opacity ${on ? '' : 'opacity-50'}`}
                      >
                        <span className={`relative h-5 w-9 flex-none rounded-full transition-colors ${on ? 'bg-accent' : 'border border-border bg-surface-2'}`}>
                          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-text">{tree.name}</span>
                          <span className="block truncate text-xs text-muted">
                            {tree.folders.length} section{tree.folders.length === 1 ? '' : 's'} · {tree.folders.map((f) => f.name).join(', ')}
                          </span>
                        </span>
                        <span className="flex-none rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                          {kindLabel}
                        </span>
                      </button>
                    );
                  })}
                  {visible.length === 0 && (
                    <div className="border-t border-border px-3.5 py-3 text-sm text-faint">Nothing matches that search.</div>
                  )}
                </div>
              </div>

              {groups.skipped.length > 0 && (
                <p className="text-xs text-faint">
                  Skipped {groups.skipped.length} search-only catalog{groups.skipped.length === 1 ? '' : 's'} (e.g. “{groups.skipped[0]}”).
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={presetId}
                  onChange={(e) => setPresetId(e.target.value)}
                  disabled={!presets.length}
                  className="min-w-[210px] rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
                >
                  {presets.length === 0 && <option value="">No presets yet</option>}
                  {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                </select>
                <div className="flex gap-1.5">
                  {TABS.map((value) => (
                    <button
                      key={value}
                      onClick={() => setTab(value)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${tab === value ? 'border-text bg-text text-bg' : 'border-border text-muted hover:text-text'}`}
                    >
                      {TAB_LABELS[value]}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {progress && <p className="text-xs text-muted">{progress}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>Not now</Button>
          <Button
            size="sm"
            onClick={commit}
            loading={busy}
            disabled={!manifest || selectedCount === 0 || !presetId}
          >
            Add {selectedCount} widget{selectedCount === 1 ? '' : 's'}
          </Button>
        </div>
      </div>
    </div>
  );
}
