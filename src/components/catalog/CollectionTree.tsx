import { useRef, useState, type RefObject } from 'react';
import type { Collection, Folder } from '../../types';
import { useAutoScrollOnDrag } from '../../hooks/useAutoScrollOnDrag';

type NodeKind = 'collection' | 'folder';
type DropZone = 'before' | 'after' | 'inside';

interface TreeNode {
  kind: NodeKind;
  id: string;
  key: string; // `${kind}:${id}` — unique across both tables
  name: string;
  enabled: boolean;
  collectionId?: string; // folders only — which collection they physically belong to
  raw: Collection | Folder;
}

function nodeKey(kind: NodeKind, id: string): string {
  return `${kind}:${id}`;
}

/** Every collection + every folder, each tagged with its tree parent key
 *  (or null for a root). A folder's parent is another folder if
 *  parent_folder_id is set, otherwise its own collection. A collection's
 *  parent is another collection or a folder, whichever parent_*_id is set,
 *  otherwise it's a root. */
function buildNodes(collections: Collection[], folders: Folder[]): { nodes: TreeNode[]; parentOf: Record<string, string | null> } {
  const nodes: TreeNode[] = [];
  const parentOf: Record<string, string | null> = {};

  for (const c of collections) {
    const key = nodeKey('collection', c.id);
    nodes.push({ kind: 'collection', id: c.id, key, name: c.name, enabled: c.enabled, raw: c });
    parentOf[key] = c.parent_collection_id
      ? nodeKey('collection', c.parent_collection_id)
      : c.parent_folder_id
      ? nodeKey('folder', c.parent_folder_id)
      : null;
  }
  for (const f of folders) {
    const key = nodeKey('folder', f.id);
    nodes.push({ kind: 'folder', id: f.id, key, name: f.name, enabled: f.enabled, collectionId: f.collection_id, raw: f });
    parentOf[key] = f.parent_folder_id ? nodeKey('folder', f.parent_folder_id) : nodeKey('collection', f.collection_id);
  }
  return { nodes, parentOf };
}

interface Props {
  collections: Collection[];
  allFolders: Folder[];
  selectedId: string | null;
  selectedFolderId: string | null;
  onSelectCollection: (id: string) => void;
  onSelectFolder: (folder: Folder) => void;
  onAddCollection: () => void;
  onDeleteCollection: (id: string) => void;
  onToggleCollectionEnabled: (id: string, enabled: boolean) => void;
  onToggleFolderEnabled: (id: string, enabled: boolean) => void;
  onNestCollectionUnderCollection: (childId: string, parentId: string) => void;
  onNestCollectionUnderFolder: (collectionId: string, folderId: string) => void;
  onNestFolderUnderFolder: (folderId: string, parentFolderId: string) => void;
  onUnnestCollection: (id: string) => void;
  onUnnestFolder: (id: string) => void;
  onReorderCollectionSiblings: (draggedId: string, targetId: string, zone: 'before' | 'after', parentKey: string | null) => void;
  onReorderFolderSiblings: (draggedId: string, targetId: string, zone: 'before' | 'after', parentKey: string) => void;
}

export function CollectionTree({
  collections, allFolders, selectedId, selectedFolderId,
  onSelectCollection, onSelectFolder, onAddCollection, onDeleteCollection,
  onToggleCollectionEnabled, onToggleFolderEnabled,
  onNestCollectionUnderCollection, onNestCollectionUnderFolder, onNestFolderUnderFolder,
  onUnnestCollection, onUnnestFolder,
  onReorderCollectionSiblings, onReorderFolderSiblings,
}: Props) {
  const { nodes, parentOf } = buildNodes(collections, allFolders);
  const byParent: Record<string, TreeNode[]> = {};
  for (const n of nodes) {
    const p = parentOf[n.key] ?? 'root';
    (byParent[p] ??= []).push(n);
  }
  const roots = byParent['root'] ?? [];

  // Nodes with a parent get collapsed by default (keeps the initial tree
  // short); anything with no children, or a root, starts open.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const n of nodes) {
      const hasChildren = (byParent[n.key] ?? []).length > 0;
      const isRoot = (parentOf[n.key] ?? null) === null;
      if (hasChildren && !isRoot) initial.add(n.key);
    }
    return initial;
  });
  function toggleCollapsed(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const dragRef = useRef<{ kind: NodeKind; id: string } | null>(null);
  const [dragOver, setDragOver] = useState<{ key: string; zone: DropZone } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useAutoScrollOnDrag(scrollRef as RefObject<HTMLElement | null>);

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, node: TreeNode) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const zone: DropZone = y < rect.height * 0.25 ? 'before' : y > rect.height * 0.75 ? 'after' : 'inside';
    if (dragOver?.key !== node.key || dragOver.zone !== zone) setDragOver({ key: node.key, zone });
  }

  function handleDrop(target: TreeNode) {
    const dragged = dragRef.current;
    const zone = dragOver?.zone;
    dragRef.current = null;
    setDragOver(null);
    if (!dragged || !zone) return;
    if (dragged.kind === target.kind && dragged.id === target.id) return;

    if (zone === 'inside') {
      if (dragged.kind === 'collection' && target.kind === 'collection') {
        onNestCollectionUnderCollection(dragged.id, target.id);
      } else if (dragged.kind === 'collection' && target.kind === 'folder') {
        onNestCollectionUnderFolder(dragged.id, target.id);
      } else if (dragged.kind === 'folder' && target.kind === 'folder') {
        // Folders keep a fixed collection_id — nesting only makes sense
        // within the same collection (see the raw Folder's collection_id);
        // the app's own folder lookups are scoped by collection_id too, so
        // a cross-collection folder nest would never actually render.
        const draggedFolder = target.raw as Folder;
        const draggedNode = nodes.find((n) => n.key === nodeKey('folder', dragged.id));
        if (draggedNode?.collectionId === draggedFolder.collection_id) {
          onNestFolderUnderFolder(dragged.id, target.id);
        }
      }
      // folder -> collection: no schema concept, ignored.
      return;
    }

    // Reorder (before/after): only meaningful between same-kind siblings
    // under the same parent — sort_order lives on two different tables, so
    // a mixed-kind edge-drop has no sensible interpretation and is ignored.
    if (dragged.kind !== target.kind) return;
    const targetParentKey = parentOf[target.key] ?? null;
    const draggedParentKey = parentOf[nodeKey(dragged.kind, dragged.id)] ?? null;
    if (dragged.kind === 'collection') {
      onReorderCollectionSiblings(dragged.id, target.id, zone, targetParentKey);
    } else {
      // Folder reordering requires a concrete parent (its collection, or a
      // parent folder) — always non-null for a folder node.
      if (targetParentKey && draggedParentKey === targetParentKey) {
        onReorderFolderSiblings(dragged.id, target.id, zone, targetParentKey);
      }
    }
  }

  function renderNode(node: TreeNode, depth: number): React.ReactNode {
    const children = byParent[node.key] ?? [];
    const isCollapsed = collapsed.has(node.key);
    const zone = dragOver?.key === node.key ? dragOver.zone : null;
    const isSelected = node.kind === 'collection' ? node.id === selectedId : node.id === selectedFolderId;

    return (
      <div key={node.key}>
        <div
          draggable
          onDragStart={() => { dragRef.current = { kind: node.kind, id: node.id }; }}
          onDragOver={(e) => handleDragOver(e, node)}
          onDragLeave={() => setDragOver((cur) => (cur?.key === node.key ? null : cur))}
          onDrop={() => handleDrop(node)}
          onClick={() => (node.kind === 'collection' ? onSelectCollection(node.id) : onSelectFolder(node.raw as Folder))}
          className={`group relative flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] transition-colors ${
            isSelected ? 'bg-accent-light text-accent' : 'hover:bg-surface-2'
          } ${zone === 'inside' ? 'ring-1 ring-inset ring-accent bg-accent-light/40' : ''} ${node.enabled === false ? 'opacity-50' : ''}`}
          style={{ paddingLeft: 8 + depth * 18 }}
        >
          {zone === 'before' && <div className="absolute inset-x-1 top-0 h-0.5 bg-accent" />}
          {zone === 'after' && <div className="absolute inset-x-1 bottom-0 h-0.5 bg-accent" />}

          {children.length > 0 ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleCollapsed(node.key); }}
              className="flex h-4 w-4 flex-none items-center justify-center text-faint hover:text-text"
            >
              {isCollapsed ? '▸' : '▾'}
            </button>
          ) : (
            <span className="w-4 flex-none" />
          )}

          <span className="flex-none text-[10px] opacity-60">{node.kind === 'collection' ? '▤' : '▢'}</span>
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
          {children.length > 0 && (
            <span className="flex-none font-mono text-[9px] text-faint">{children.length}</span>
          )}

          <span className="hidden flex-none items-center gap-1 group-hover:flex" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => (node.kind === 'collection' ? onToggleCollectionEnabled(node.id, node.enabled === false) : onToggleFolderEnabled(node.id, node.enabled === false))}
              title={node.enabled === false ? 'Disabled — click to enable' : 'Enabled — click to disable'}
              className="rounded px-1 font-mono text-[9px] text-faint hover:text-text"
            >
              {node.enabled === false ? 'off' : 'on'}
            </button>
            {(parentOf[node.key] ?? null) !== null && (
              <button
                onClick={() => (node.kind === 'collection' ? onUnnestCollection(node.id) : onUnnestFolder(node.id))}
                title="Remove from parent — back to top level"
                className="rounded px-1 font-mono text-[9px] text-faint hover:text-red-400"
              >
                ✕
              </button>
            )}
            {node.kind === 'collection' && (
              <button
                onClick={() => onDeleteCollection(node.id)}
                title="Delete collection"
                className="rounded px-1 font-mono text-[9px] text-faint hover:text-red-400"
              >
                del
              </button>
            )}
          </span>
        </div>
        {!isCollapsed && children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="font-mono text-[10px] uppercase tracking-wide text-faint">
          {collections.length} collections · drag to reorder or nest
        </span>
        <button onClick={onAddCollection} className="font-mono text-[10px] text-accent hover:underline">+ new</button>
      </div>
      <div ref={scrollRef} className="max-h-[calc(100vh-11rem)] overflow-y-auto pr-1">
        {roots.length === 0 ? (
          <p className="px-2 py-4 font-mono text-[11px] text-faint">No collections found.</p>
        ) : (
          roots.map((n) => renderNode(n, 0))
        )}
      </div>
    </div>
  );
}
