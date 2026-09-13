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
 * from URL flow. Parses either a native Moonlit `[HomeWidget]` export or a
 * real Fusion export, previews every found widget with an on/off toggle
 * (import only what you want), then appends the toggled-on widgets to the
 * selected preset + tab as `home_preset_items` rows.
 */
export function ImportWidgetsDialog({ presetId, presetName, tab, startSortOrder, onClose, onImported }: Props) {
  const [mode, setMode] = useState<'paste' | 'url'>('paste');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedWidgetsExport | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function resetPreview() {
    setParsed(null);
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

          <p className="text-xs text-faint">Accepts a Moonlit widgets export or a Fusion widgets export.</p>

          {error && <p className="text-sm text-red-400">{error}</p>}

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
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          {parsed ? (
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
