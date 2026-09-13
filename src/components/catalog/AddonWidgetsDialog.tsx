import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import type { HomePreset } from '../../types';
import type { WidgetTab } from './WidgetGrid';
import { importWidgetsIntoPreset } from '../../lib/importWidgets';
import { catalogsToWidgets, fetchAddonManifest, type AddonManifestInfo } from '../../lib/addonCatalogWidgets';

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
 * add-on's manifest and turns its declared catalogs into preset widgets.
 * Append-only — the chosen widgets are added after that tab's current last
 * item, and re-running for the same add-on updates those same rows in place
 * (stable source ids), never replacing or reshuffling existing widgets.
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const info = await fetchAddonManifest(manifestUrl);
        if (cancelled) return;
        setManifest(info);
        setSelected(new Set(info.catalogs.map((_, index) => index)));
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

  const catalogs = useMemo(() => manifest?.catalogs ?? [], [manifest]);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const indexed = catalogs.map((catalog, index) => ({ catalog, index }));
    if (!query) return indexed;
    return indexed.filter(({ catalog }) =>
      catalog.name.toLowerCase().includes(query) || catalog.id.toLowerCase().includes(query));
  }, [catalogs, search]);

  const selectedCount = selected.size;

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function commit() {
    if (!manifest || !presetId) return;
    const widgets = catalogsToWidgets(manifest).filter((_, index) => selected.has(index));
    if (!widgets.length) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await importWidgetsIntoPreset({ presetId, tab, widgets, startSortOrder });
      const presetName = presets.find((p) => p.id === presetId)?.name ?? 'preset';
      const updatedNote = outcome.updated ? `, ${outcome.updated} updated` : '';
      const total = outcome.inserted + outcome.updated;
      onAdded(`Added ${total} widget${total === 1 ? '' : 's'} to “${presetName} · ${TAB_LABELS[tab]}” (${outcome.inserted} new${updatedNote}).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
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
              {manifest.catalogs.length} catalogs
            </span>
          )}
          <button onClick={onClose} className="ml-auto text-muted transition-colors hover:text-text" aria-label="Close">✕</button>
        </div>

        <div className="flex flex-col gap-3 overflow-auto px-5 py-4">
          {loading && <p className="text-sm text-muted">Reading the add-on&apos;s manifest…</p>}

          {error && <p className="text-sm text-red-400">{error}</p>}

          {manifest && catalogs.length === 0 && (
            <p className="text-sm text-muted">This add-on declares no catalogs, so there are no widgets to add.</p>
          )}

          {manifest && catalogs.length > 0 && (
            <>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search catalogs…"
                className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-faint focus:border-accent focus:outline-none"
              />

              <div className="overflow-hidden rounded-xl border border-border">
                <div className="flex items-center justify-between bg-surface-2 px-3.5 py-2.5 text-sm text-muted">
                  <span>
                    <b className="text-text">{selectedCount}</b> of <b className="text-text">{catalogs.length}</b> selected
                  </span>
                  <span className="flex gap-3 text-xs font-semibold text-accent">
                    <button className="hover:underline" onClick={() => setSelected(new Set(catalogs.map((_, i) => i)))}>Select all</button>
                    <button className="hover:underline" onClick={() => setSelected(new Set())}>Select none</button>
                  </span>
                </div>
                <div className="max-h-56 overflow-auto">
                  {visible.map(({ catalog, index }) => {
                    const on = selected.has(index);
                    return (
                      <button
                        key={`${catalog.type}:${catalog.id}`}
                        type="button"
                        onClick={() => toggle(index)}
                        className={`flex w-full items-center gap-3 border-t border-border px-3.5 py-2 text-left text-sm transition-opacity ${on ? '' : 'opacity-50'}`}
                      >
                        <span className={`relative h-5 w-9 flex-none rounded-full transition-colors ${on ? 'bg-accent' : 'border border-border bg-surface-2'}`}>
                          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-text">{catalog.name}</span>
                        <span className="flex-none rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                          {catalog.type}
                        </span>
                      </button>
                    );
                  })}
                  {visible.length === 0 && (
                    <div className="border-t border-border px-3.5 py-3 text-sm text-faint">No catalogs match that search.</div>
                  )}
                </div>
              </div>

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
