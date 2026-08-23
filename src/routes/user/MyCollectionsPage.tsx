import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SourcesTable } from '../../components/catalog/SourcesTable';
import {
  listPersonalCollections, createPersonalCollection, deletePersonalCollection,
  listFolders, createFolder, deleteFolder,
  listCatalogSources, addCatalogSource, deleteCatalogSource,
} from '../../lib/personalCollections';
import type { Collection, Folder, FolderCatalog, InstalledAddon } from '../../types';

export default function MyCollectionsPage() {
  const { role, activeProfile } = useAuth();
  const eligible = role === 'premium_plus' || role === 'admin';

  const [collections, setCollections] = useState<Collection[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [catalogs, setCatalogs] = useState<FolderCatalog[]>([]);
  const [addons, setAddons] = useState<InstalledAddon[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eligible || !activeProfile) { setLoading(false); return; }
    const profileId = activeProfile.id;
    (async () => {
      setCollections(await listPersonalCollections(profileId));
      const { data } = await supabase
        .from('installed_addons').select('*').eq('profile_id', profileId).order('sort_order');
      setAddons((data ?? []) as InstalledAddon[]);
      setLoading(false);
    })();
  }, [eligible, activeProfile]);

  useEffect(() => {
    if (!selectedCollection) { setFolders([]); return; }
    listFolders(selectedCollection.id).then(setFolders);
    setSelectedFolder(null);
  }, [selectedCollection]);

  useEffect(() => {
    if (!selectedFolder) { setCatalogs([]); return; }
    listCatalogSources(selectedFolder.id).then(setCatalogs);
  }, [selectedFolder]);

  async function handleAddCollection() {
    if (!activeProfile) return;
    const name = prompt('Collection name')?.trim();
    if (!name) return;
    const created = await createPersonalCollection(activeProfile.id, name, collections.length);
    if (created) setCollections((p) => [...p, created]);
  }

  async function handleDeleteCollection(id: string) {
    if (!confirm('Delete this collection and its folders?')) return;
    await deletePersonalCollection(id);
    setCollections((p) => p.filter((c) => c.id !== id));
    if (selectedCollection?.id === id) setSelectedCollection(null);
  }

  async function handleAddFolder() {
    if (!selectedCollection) return;
    const name = prompt('Folder name')?.trim();
    if (!name) return;
    const created = await createFolder(selectedCollection.id, name, folders.length);
    if (created) setFolders((p) => [...p, created]);
  }

  async function handleDeleteFolder(id: string) {
    if (!confirm('Delete this folder and its sources?')) return;
    await deleteFolder(id);
    setFolders((p) => p.filter((f) => f.id !== id));
    if (selectedFolder?.id === id) setSelectedFolder(null);
  }

  async function handleAddCatalog(
    catalogId: string, mediaType: string, genre: string | null, addonId: string | null,
  ) {
    if (!selectedFolder) return;
    const created = await addCatalogSource({
      folderId: selectedFolder.id, catalogId, mediaType, genre, addonId,
    });
    if (created) setCatalogs((p) => [...p, created]);
  }

  async function handleDeleteCatalog(id: string) {
    await deleteCatalogSource(id);
    setCatalogs((p) => p.filter((c) => c.id !== id));
  }

  if (!eligible) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-text mb-2">My Collections</h1>
          <p className="text-sm text-muted">
            Building your own collections is only available on Premium+.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text">My Collections</h1>
            <p className="text-sm text-muted">
              Private to this profile — built from your own add-ons.
            </p>
          </div>
          <Button onClick={handleAddCollection} size="md">+ New collection</Button>
        </div>

        {loading ? (
          <p className="text-muted text-sm">Loading…</p>
        ) : collections.length === 0 ? (
          <p className="text-muted text-sm">No collections yet.</p>
        ) : (
          <div className="flex flex-col gap-2 mb-6">
            {collections.map((c) => (
              <Card key={c.id} className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => setSelectedCollection(c)}
                  className={`flex-1 text-left text-sm font-medium ${
                    selectedCollection?.id === c.id ? 'text-accent' : 'text-text'
                  }`}
                >
                  {c.name}
                </button>
                <button
                  onClick={() => handleDeleteCollection(c.id)}
                  className="text-muted hover:text-red-500 text-lg leading-none"
                >
                  &times;
                </button>
              </Card>
            ))}
          </div>
        )}

        {selectedCollection && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text">
                Folders in {selectedCollection.name}
              </h2>
              <Button onClick={handleAddFolder} size="sm">+ Add folder</Button>
            </div>
            {folders.length === 0 ? (
              <p className="text-muted text-sm">No folders yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {folders.map((f) => (
                  <Card key={f.id} className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => setSelectedFolder(f)}
                      className={`flex-1 text-left text-sm ${
                        selectedFolder?.id === f.id ? 'text-accent' : 'text-text'
                      }`}
                    >
                      {f.name}
                    </button>
                    <button
                      onClick={() => handleDeleteFolder(f.id)}
                      className="text-muted hover:text-red-500 text-lg leading-none"
                    >
                      &times;
                    </button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedFolder && (
          <Card className="p-6">
            {/* Provider (TMDB) sources stay admin-only — personal collections are
                addon-catalog-driven in Phase 1, so those two props are
                deliberately inert, not unimplemented. */}
            <SourcesTable
              folder={selectedFolder}
              sources={[]}
              catalogs={catalogs}
              onAddSource={async () => {}}
              onDeleteSource={async () => {}}
              onAddCatalog={handleAddCatalog}
              onDeleteCatalog={handleDeleteCatalog}
              addons={addons}
            />
          </Card>
        )}
      </div>
    </AppShell>
  );
}
