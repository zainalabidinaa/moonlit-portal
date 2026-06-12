import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AppShell } from '../../components/layout/AppShell';
import { Button } from '../../components/ui/Button';
import { CollectionRow } from '../../components/catalog/CollectionRow';
import { CollectionEditor } from '../../components/catalog/CollectionEditor';
import type { Collection } from '../../types';

export default function CatalogPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const dragIndex = useRef<number | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: cols } = await supabase.from('collections').select('*').order('sort_order');
    const rows = cols ?? [];
    setCollections(rows);

    if (rows.length > 0) {
      const { data: folders } = await supabase
        .from('folders')
        .select('collection_id')
        .in('collection_id', rows.map(c => c.id));
      const counts: Record<string, number> = {};
      for (const f of folders ?? []) {
        counts[f.collection_id] = (counts[f.collection_id] ?? 0) + 1;
      }
      setFolderCounts(counts);
    }

    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this collection?')) return;
    await supabase.from('collections').delete().eq('id', id);
    setCollections(prev => prev.filter(c => c.id !== id));
  }

  function handleDragStart(i: number) { dragIndex.current = i; }
  async function handleDrop(i: number) {
    if (dragIndex.current === null || dragIndex.current === i) return;
    const reordered = [...collections];
    const [moved] = reordered.splice(dragIndex.current, 1);
    reordered.splice(i, 0, moved);
    setCollections(reordered);
    dragIndex.current = null;
    await Promise.all(reordered.map((c, idx) => supabase.from('collections').update({ sort_order: idx }).eq('id', c.id)));
  }

  const editingCollection = editingId && editingId !== 'new'
    ? collections.find(c => c.id === editingId) ?? null
    : null;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text">Catalog</h1>
            <p className="text-sm text-muted mt-0.5">{collections.length} collection{collections.length !== 1 ? 's' : ''}</p>
          </div>
          <Button onClick={() => setEditingId('new')}>+ New Collection</Button>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-surface rounded-xl animate-pulse" />
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <p className="text-sm">No collections yet.</p>
            <Button className="mt-4" onClick={() => setEditingId('new')}>Create your first collection</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {collections.map((c, i) => (
              <CollectionRow
                key={c.id}
                collection={c}
                folderCount={folderCounts[c.id] ?? 0}
                onEdit={() => setEditingId(c.id)}
                onDelete={() => handleDelete(c.id)}
                onDragStart={() => handleDragStart(i)}
                onDrop={() => handleDrop(i)}
              />
            ))}
          </div>
        )}
      </div>

      {editingId && (
        <CollectionEditor
          collection={editingCollection}
          onClose={() => setEditingId(null)}
          onSaved={() => { setEditingId(null); load(); }}
        />
      )}
    </AppShell>
  );
}
