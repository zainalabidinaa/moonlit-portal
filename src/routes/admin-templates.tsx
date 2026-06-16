import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/app/AuthProvider';
import { Sidebar } from '@/components/Sidebar';
import { supabase } from '@/lib/supabase';
import {
  wipeCollections,
  importCollections,
  buildDiscoverMapFromAioConfig,
  type ImportResult,
} from '@/lib/importCollections';

interface Template {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  nuvio_json: unknown[];
  discover_map: Record<string, string> | null;
}

type ActivateState = 'idle' | 'wiping' | 'importing' | 'done' | 'error';

export default function AdminTemplatesPage() {
  const { currentProfile, isLoading } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [nuvioFile, setNuvioFile] = useState<File | null>(null);
  const [aioFile, setAioFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [activateState, setActivateState] = useState<ActivateState>('idle');
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [activateError, setActivateError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!currentProfile) return;
    if (currentProfile.role !== 'admin') { navigate({ to: '/home' }); return; }
    loadTemplates();
  }, [currentProfile, isLoading]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [progressLog]);

  async function loadTemplates() {
    setLoading(true);
    const { data } = await supabase.from('collection_templates').select('*').order('created_at');
    setTemplates((data as Template[]) ?? []);
    setLoading(false);
  }

  async function handleSave() {
    if (!newName.trim() || !nuvioFile) { setSaveError('Name and Nuvio JSON are required.'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const nuvioJson = JSON.parse(await nuvioFile.text());
      if (!Array.isArray(nuvioJson)) throw new Error('Nuvio JSON must be an array of collections.');

      let discoverMap: Record<string, string> | null = null;
      if (aioFile) {
        discoverMap = buildDiscoverMapFromAioConfig(JSON.parse(await aioFile.text()));
      }

      const { error } = await supabase.from('collection_templates').insert({
        name: newName.trim(),
        description: newDescription.trim() || null,
        nuvio_json: nuvioJson,
        discover_map: discoverMap,
        is_active: false,
      });
      if (error) throw error;

      setShowForm(false);
      setNewName('');
      setNewDescription('');
      setNuvioFile(null);
      setAioFile(null);
      await loadTemplates();
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(template: Template) {
    setActivatingId(template.id);
    setActivateState('wiping');
    setProgressLog(['Wiping existing collections…']);
    setImportResult(null);
    setActivateError(null);

    try {
      await wipeCollections();
      setProgressLog(l => [...l, 'Wipe complete. Starting import…', '']);
      setActivateState('importing');

      const result = await importCollections(
        template.nuvio_json as Record<string, unknown>[],
        template.discover_map ?? {},
        msg => setProgressLog(l => [...l, msg])
      );

      await supabase.from('collection_templates').update({ is_active: false }).neq('id', template.id);
      await supabase.from('collection_templates').update({ is_active: true }).eq('id', template.id);

      setImportResult(result);
      setActivateState('done');
      setProgressLog(l => [
        ...l, '',
        `✅ Done — ${result.collections} collections, ${result.folders} folders, ${result.sources} sources`,
      ]);
      await loadTemplates();
    } catch (e) {
      setActivateError((e as Error).message);
      setActivateState('error');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return;
    await supabase.from('collection_templates').delete().eq('id', id);
    await loadTemplates();
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const isActivating = activateState === 'wiping' || activateState === 'importing';

  return (
    <Sidebar>
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white">Collection Templates</h1>
            <p className="mt-1 text-sm text-nightarc-muted">
              Save Nuvio export profiles and switch between them to change what the app shows.
            </p>
          </div>
          <button
            onClick={() => { setShowForm(v => !v); setSaveError(null); }}
            className="flex-none px-4 py-2 rounded-xl bg-nightarc-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {showForm ? 'Cancel' : '+ New Template'}
          </button>
        </div>

        {/* New template form */}
        {showForm && (
          <div className="p-5 rounded-2xl bg-nightarc-surface space-y-4">
            <h2 className="font-semibold text-white">Upload Template</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-nightarc-muted mb-1 block">Name *</label>
                <input
                  className="w-full px-3 py-2 bg-nightarc-elevated rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-nightarc-accent"
                  placeholder="e.g. Anime Focus"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-nightarc-muted mb-1 block">Description</label>
                <input
                  className="w-full px-3 py-2 bg-nightarc-elevated rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-nightarc-accent"
                  placeholder="Optional note"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FileDropZone
                label="Nuvio Collections JSON *"
                accept=".json"
                file={nuvioFile}
                hint="Export from Nuvio → Collections → Export Profile"
                onChange={setNuvioFile}
              />
              <FileDropZone
                label="AIOMetadata Config (optional)"
                accept=".json"
                file={aioFile}
                hint="Enables DISCOVER catalog resolution"
                onChange={setAioFile}
              />
            </div>

            {saveError && <p className="text-sm text-red-400">{saveError}</p>}

            <button
              onClick={handleSave}
              disabled={saving || !newName.trim() || !nuvioFile}
              className="px-4 py-2 rounded-xl bg-nightarc-accent text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {saving ? 'Saving…' : 'Save Template'}
            </button>
          </div>
        )}

        {/* Templates list */}
        {loading ? (
          <p className="text-sm text-nightarc-muted">Loading…</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-nightarc-muted">No templates yet. Upload one above.</p>
        ) : (
          <div className="space-y-3">
            {templates.map(t => (
              <div key={t.id} className="p-5 rounded-2xl bg-nightarc-surface">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white">{t.name}</span>
                      {t.is_active && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-nightarc-accent/40 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-nightarc-accent">
                          <span className="h-1.5 w-1.5 rounded-full bg-nightarc-accent" />
                          Active
                        </span>
                      )}
                    </div>
                    {t.description && <p className="mt-0.5 text-sm text-nightarc-muted">{t.description}</p>}
                    <p className="mt-1 text-xs text-nightarc-muted/60">
                      {Array.isArray(t.nuvio_json) ? t.nuvio_json.length : '?'} collections ·{' '}
                      {t.discover_map ? 'DISCOVER catalogs mapped' : 'No DISCOVER map'} ·{' '}
                      Added {formatDate(t.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-none items-center gap-2">
                    <button
                      disabled={isActivating}
                      onClick={() => handleActivate(t)}
                      className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-opacity disabled:opacity-40 ${
                        t.is_active
                          ? 'bg-nightarc-elevated text-white hover:opacity-80'
                          : 'bg-nightarc-accent text-white hover:opacity-90'
                      }`}
                    >
                      {activatingId === t.id && isActivating ? '…' : t.is_active ? 'Reactivate' : 'Activate'}
                    </button>
                    {!t.is_active && (
                      <button
                        disabled={isActivating}
                        onClick={() => handleDelete(t.id)}
                        className="px-3 py-1.5 rounded-xl text-sm text-nightarc-muted hover:text-red-400 disabled:opacity-40 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {activatingId === t.id && progressLog.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div
                      ref={logRef}
                      className="h-48 overflow-y-auto rounded-xl bg-black/60 border border-white/8 p-3 font-mono text-xs text-nightarc-muted leading-relaxed"
                    >
                      {progressLog.map((line, i) => (
                        <div
                          key={i}
                          className={
                            line.startsWith('✅') ? 'text-nightarc-accent' :
                            line.startsWith('  → error') ? 'text-red-400' : undefined
                          }
                        >
                          {line || ' '}
                        </div>
                      ))}
                      {isActivating && <span className="animate-pulse">▌</span>}
                    </div>

                    {activateState === 'done' && importResult && (
                      <div className="flex gap-6 rounded-xl bg-nightarc-elevated px-4 py-3 text-sm">
                        {[
                          { label: 'Collections', value: importResult.collections },
                          { label: 'Folders', value: importResult.folders },
                          { label: 'Sources', value: importResult.sources },
                          { label: 'Skipped', value: importResult.skipped },
                        ].map(s => (
                          <div key={s.label}>
                            <div className="text-lg font-bold text-white">{s.value}</div>
                            <div className="text-xs text-nightarc-muted">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {activateState === 'error' && activateError && (
                      <p className="text-sm text-red-400">Error: {activateError}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Sidebar>
  );
}

function FileDropZone({
  label, accept, file, hint, onChange,
}: {
  label: string;
  accept: string;
  file: File | null;
  hint: string;
  onChange: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onChange(f);
  }

  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors cursor-pointer
        ${dragging ? 'border-nightarc-accent bg-nightarc-accent/5' : 'border-white/10 hover:border-nightarc-accent/50'}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={e => onChange(e.target.files?.[0] ?? null)}
      />
      <div className="text-xs font-medium text-nightarc-muted uppercase tracking-wide mb-1">{label}</div>
      {file ? (
        <div className="text-sm text-nightarc-accent font-medium truncate max-w-full">{file.name}</div>
      ) : (
        <>
          <div className="text-sm text-white/70">Drop file or click to browse</div>
          <div className="mt-1 text-xs text-nightarc-muted/60">{hint}</div>
        </>
      )}
    </div>
  );
}
