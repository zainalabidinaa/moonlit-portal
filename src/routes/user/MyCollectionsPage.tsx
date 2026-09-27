import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { SourcesTable } from '../../components/catalog/SourcesTable';
import {
  listPersonalCollections, createPersonalCollection, deletePersonalCollection,
  listFolders, createFolder, deleteFolder,
  listCatalogSources, addCatalogSource, deleteCatalogSource,
} from '../../lib/personalCollections';
import type { Collection, Folder, FolderCatalog } from '../../types';
import type { NativeSourceRow } from '../../lib/addSource';

export default function MyCollectionsPage() {
  const { role, activeProfile } = useAuth();
  const eligible = role === 'studio';

  const [collections, setCollections] = useState<Collection[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [catalogs, setCatalogs] = useState<FolderCatalog[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eligible || !activeProfile) { setLoading(false); return; }
    const profileId = activeProfile.id;
    (async () => {
      setCollections(await listPersonalCollections(profileId));
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

  async function handleAddNativeSource(row: NativeSourceRow) {
    if (!selectedFolder) return;
    const created = await addCatalogSource({
      folderId: selectedFolder.id,
      catalogId: row.catalog_id,
      mediaType: row.media_type,
      genre: row.genre,
      addonId: null,
      filterParams: row.filter_params,
    });
    if (!created) throw new Error('Could not add the source. Try again.');
    setCatalogs((p) => [...p, created]);
  }

  async function handleDeleteCatalog(id: string) {
    await deleteCatalogSource(id);
    setCatalogs((p) => p.filter((c) => c.id !== id));
  }

  if (!eligible) {
    return (
      <AppShell wide={false}>
        <div className="grid gap-6">
          <div>
            <h1 className="text-[34px] font-semibold tracking-tight">My collections</h1>
            <p className="mt-1.5 text-[15px] text-muted">Your own catalog on top of Moonlit's.</p>
          </div>
          <div className="grid gap-3.5 rounded-2xl border border-accent/35 bg-[linear-gradient(135deg,rgba(255,122,61,.12),transparent_60%)] bg-surface p-[22px]">
            <b className="text-base font-semibold">Building your own collections is only available on Studio.</b>
            <p className="text-sm text-muted">Make your own folders and add your own sources on top of the Moonlit catalog. Studio is $14.99 a month.</p>
            <a href="/billing" className="inline-flex h-[38px] w-fit items-center rounded-full bg-text px-4 text-sm font-semibold text-[#0a0a0c] hover:bg-white">Upgrade to Studio</a>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="text-[34px] font-semibold tracking-tight">My collections</h1>
            <p className="mt-1.5 text-[15px] text-muted">
              Private to this profile, built from your own add-ons.
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
                  className="text-muted hover:text-red-400 text-lg leading-none"
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
                      className="text-muted hover:text-red-400 text-lg leading-none"
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
            <SourcesTable
              mode="personal"
              folder={selectedFolder}
              sources={[]}
              catalogs={catalogs}
              onAddSource={async () => {}}
              onDeleteSource={async () => {}}
              onAddCatalog={async () => {}}
              onDeleteCatalog={handleDeleteCatalog}
              onAddNativeSource={handleAddNativeSource}
            />
          </Card>
        )}
      </div>
    </AppShell>
  );
}
