import { useState } from 'react';
import { Button } from '../ui/Button';
import type { HomePresetItem } from '../../types';
import type { WidgetTab } from './WidgetGrid';
import {
  fetchWidgetsExport,
  importWidgetsIntoPreset,
  parseWidgetsExport,
  type ImportedWidget,
  type ParsedWidgetsExport,
} from '../../lib/importWidgets';
import { syncCollectionTrees, type CollectionTree } from '../../lib/collectionTrees';
import { collectionsToTrees, parseCollectionsProfile } from '../../lib/nuvioCollections';

const STYLE_LABELS: Record<string, string> = {
  standard: 'Row Classic',
  topTen: 'Row Numbered',
  cardStack: 'Card Stack',
  carouselCinematic: 'Carousel',
  heroBanner: 'Hero',
  collectionsRow: 'Collections Row',
};

interface Props {
  presetId: string;
  presetName: string;
  tab: WidgetTab;
  /** Sort order for the first imported item — continues after the tab's
   *  current last item so the import appends instead of reshuffling. */
  startSortOrder: number;
  onClose: () => void;
  onImported: (items: HomePresetItem[], summary: string) => void;
}

/**
 * "Import Widgets" — the portal counterpart of the app's Paste JSON / Import
 * from URL flow. Accepts:
 *
 * - a native Moonlit `[HomeWidget]` export or a real Fusion export —
 *   previewed with an on/off toggle per widget, then appended to the
 *   selected preset + tab as `home_preset_items` rows; and
 * - a Nuvio/Moonlit **collections profile**
 *   (`[{title, folders:[{sources:[…]}]}]`) — previewed per collection, then
 *   synced as real collections + folders + sources with one widget per
 *   collection. Nothing is wiped; re-importing an updated profile updates
 *   the same rows (see `syncCollectionTrees`).
 */
export function ImportWidgetsDialog({ presetId, presetName, tab, startSortOrder, onClose, onImported }: Props) {
  const [mode, setMode] = useState<'paste' | 'url'>('paste');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedWidgetsExport | null>(null);
  const [parsedTrees, setParsedTrees] = useState<CollectionTree[] | null>(null);
  const [skippedSources, setSkippedSources] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState<string | null>(null);

  function resetPreview() {
    setParsed(null);
    setParsedTrees(null);
    setSkippedSources(0);
    setError(null);
    setSelected(new Set());
  }

  function switchMode(next: 'paste' | 'url') {
    setMode(next);
    resetPreview();
  }

  async function preview() {
    resetPreview();
    setBusy(true);
    try {
      const raw = mode === 'url'
        ? await fetchWidgetsExport(url.trim())
        : text.trim();
      if (!raw) throw new Error(mode === 'url' ? 'Enter a URL.' : 'Paste some JSON first.');

      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        throw new Error('That is not valid JSON.');
      }

      // A collections profile is a top-level array whose items carry
      // `folders`; a widget export's items carry `dataSource`.
      const items = Array.isArray(json) ? (json as Record<string, unknown>[]) : [];
      const isCollectionsProfile = items.length > 0 && items.every(
        (item) => item && typeof item === 'object' && Array.isArray((item as { folders?: unknown }).folders),
      );

      if (isCollectionsProfile) {
        const profile = parseCollectionsProfile(raw);
        const { trees, skippedSources: skipped } = collectionsToTrees(profile);
        if (!trees.length) throw new Error('No collection in that profile has usable sources.');
        setParsedTrees(trees);
        setSkippedSources(skipped);
        setSelected(new Set(trees.map((_, index) => index)));
        return;
      }

      const result = parseWidgetsExport(raw);
      if (!result.widgets.length && !result.skipped.length) throw new Error('No widgets found in that JSON.');
      setParsed(result);
      setSelected(new Set(result.widgets.map((_, index) => index)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!parsed) return;
    const chosen: ImportedWidget[] = parsed.widgets.filter((_, index) => selected.has(index));
    if (!chosen.length) return;
    setBusy(true);
    try {
      const outcome = await importWidgetsIntoPreset({ presetId, tab, widgets: chosen, startSortOrder });
      const newNote = `${outcome.inserted} new`;
      const updatedNote = outcome.updated ? `, ${outcome.updated} updated` : '';
      const skippedNote = parsed.skipped.length ? `, ${parsed.skipped.length} skipped` : '';
      const held = parsed.widgets.length - chosen.length;
      const heldNote = held > 0 ? `, ${held} left untoggled` : '';
      onImported(
        outcome.items,
        `Imported ${outcome.inserted + outcome.updated} widget${outcome.inserted + outcome.updated === 1 ? '' : 's'} (${newNote}${updatedNote}) into “${presetName} · ${tab}”${skippedNote}${heldNote}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function commitCollections() {
    if (!parsedTrees) return;
    const chosen = parsedTrees.filter((_, index) => selected.has(index));
    if (!chosen.length) return;
    setBusy(true);
    setProgress('Starting sync…');
    try {
      const outcome = await syncCollectionTrees({
        presetId,
        tab,
        trees: chosen,
        startSortOrder,
        onProgress: (message) => setProgress(message),
      });
      const widgets = outcome.presetItemsCreated + outcome.presetItemsUpdated;
      const updatedNote = outcome.presetItemsUpdated ? `, ${outcome.presetItemsUpdated} updated` : '';
      const removedNote = outcome.foldersRemoved ? `, ${outcome.foldersRemoved} folders removed` : '';
      const errorNote = outcome.errors.length ? ` — ${outcome.errors.length} failed` : '';
      onImported(
        [],
        `Synced ${widgets} widget${widgets === 1 ? '' : 's'} (${outcome.collectionsCreated + outcome.collectionsUpdated} collections, ${outcome.foldersCreated + outcome.foldersUpdated} folders, ${outcome.sourcesWritten} sources${removedNote}${updatedNote}) into “${presetName} · ${tab}”${errorNote}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const count = parsed?.widgets.length ?? 0;
  const selectedCount = selected.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5">
      <div className="flex max-h-[88vh] w-[640px] max-w-full flex-col overflow-hidden rounded-2xl border border-border-strong bg-surface">
        <div className="flex items-center border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-text">Import Widgets</h2>
          <button onClick={onClose} className="ml-auto text-muted transition-colors hover:text-text" aria-label="Close">✕</button>
        </div>

        <div className="flex flex-col gap-3 overflow-auto px-5 py-4">
          <div className="flex gap-2">
            <button
              onClick={() => switchMode('paste')}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${mode === 'paste' ? 'border-text bg-text text-bg' : 'border-border text-muted hover:text-text'}`}
            >
              Paste JSON
            </button>
            <button
              onClick={() => switchMode('url')}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${mode === 'url' ? 'border-text bg-text text-bg' : 'border-border text-muted hover:text-text'}`}
            >
              From URL
            </button>
          </div>

          {mode === 'paste' ? (
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); resetPreview(); }}
              placeholder="Paste a Moonlit widgets export or a Fusion widgets export…"
              className="h-44 w-full resize-y rounded-lg border border-border bg-bg p-3 font-mono text-xs leading-relaxed text-text focus:border-accent focus:outline-none"
            />
          ) : (
            <input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); resetPreview(); }}
              placeholder="https://example.com/widgets.json"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
            />
          )}

          <p className="text-xs text-faint">
            Accepts a Moonlit widgets export, a Fusion widgets export, or a Nuvio/Moonlit collections profile.
          </p>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {parsedTrees && (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="bg-surface-2 px-3.5 py-2.5 text-sm text-muted">
                Found <b className="text-text">{parsedTrees.length}</b> collection{parsedTrees.length === 1 ? '' : 's'} —{' '}
                <b className="text-text">{selectedCount}</b> of <b className="text-text">{parsedTrees.length}</b> selected
                {skippedSources ? <>, <b className="text-text">{skippedSources}</b> sources skipped</> : null}.
              </div>
              <div className="flex gap-3 border-t border-border px-3.5 py-1.5 text-xs">
                <button className="font-semibold text-accent hover:underline" onClick={() => setSelected(new Set(parsedTrees.map((_, i) => i)))}>
                  Select all
                </button>
                <button className="font-semibold text-accent hover:underline" onClick={() => setSelected(new Set())}>
                  Select none
                </button>
              </div>
              <div className="max-h-56 overflow-auto">
                {parsedTrees.map((tree, index) => {
                  const on = selected.has(index);
                  const sourceCount = tree.folders.reduce((sum, folder) => sum + folder.sources.length, 0);
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
                          {tree.folders.length} folder{tree.folders.length === 1 ? '' : 's'} · {sourceCount} source{sourceCount === 1 ? '' : 's'}
                        </span>
                      </span>
                      <span className="ml-auto flex-none rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                        Collection
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {parsed && (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="bg-surface-2 px-3.5 py-2.5 text-sm text-muted">
                Found <b className="text-text">{count + parsed.skipped.length}</b> widgets —{' '}
                <b className="text-text">{selectedCount}</b> of <b className="text-text">{count}</b> selected
                {parsed.skipped.length ? <>, <b className="text-text">{parsed.skipped.length}</b> skipped</> : null}.
              </div>
              <div className="flex gap-3 border-t border-border px-3.5 py-1.5 text-xs">
                <button className="font-semibold text-accent hover:underline" onClick={() => setSelected(new Set(parsed.widgets.map((_, i) => i)))}>
                  Select all
                </button>
                <button className="font-semibold text-accent hover:underline" onClick={() => setSelected(new Set())}>
                  Select none
                </button>
              </div>
              <div className="max-h-56 overflow-auto">
                {parsed.widgets.map((widget, index) => {
                  const on = selected.has(index);
                  const isRow = widget.style === 'collectionsRow';
                  const label = isRow
                    ? `Collections Row · ${(widget.dataSource as { entries?: unknown[] }).entries?.length ?? 0} tiles`
                    : STYLE_LABELS[widget.style] ?? widget.style;
                  return (
                    <button
                      key={`${widget.title}-${index}`}
                      type="button"
                      onClick={() => toggle(index)}
                      className={`flex w-full items-center gap-3 border-t border-border px-3.5 py-2 text-left text-sm transition-opacity ${on ? '' : 'opacity-50'}`}
                    >
                      <span className={`relative h-5 w-9 flex-none rounded-full transition-colors ${on ? 'bg-accent' : 'border border-border bg-surface-2'}`}>
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
                      </span>
                      <span className="truncate text-text">{widget.title}</span>
                      <span className={`ml-auto flex-none whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isRow ? 'bg-accent-light text-accent' : 'bg-surface-2 text-muted'}`}>
                        {label}
                      </span>
                    </button>
                  );
                })}
                {parsed.skipped.map((title, index) => (
                  <div key={`skipped-${title}-${index}`} className="flex items-center gap-3 border-t border-border px-3.5 py-2 text-sm opacity-60">
                    <span className="h-5 w-9 flex-none" />
                    <span className="truncate text-muted">{title}</span>
                    <span className="ml-auto flex-none rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                      Skipped
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
          {progress && <span className="mr-auto text-xs text-muted">{progress}</span>}
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          {parsedTrees ? (
            <Button size="sm" onClick={commitCollections} loading={busy} disabled={selectedCount === 0}>
              Import {selectedCount} collection{selectedCount === 1 ? '' : 's'}
            </Button>
          ) : parsed ? (
            <Button size="sm" onClick={commit} loading={busy} disabled={selectedCount === 0}>
              Import {selectedCount} widget{selectedCount === 1 ? '' : 's'}
            </Button>
          ) : (
            <Button size="sm" onClick={preview} loading={busy}>Import</Button>
          )}
        </div>
      </div>
    </div>
  );
}
