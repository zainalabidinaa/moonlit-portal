import type { FolderEntry } from '../../types';

export interface FolderCandidate {
  id: string;
  parent_folder_id?: string | null;
  name: string;
}

export interface BestImportEntry {
  entry: FolderEntry;
  inputIndex: number;
  sortOrder?: number;
  unifiedOrder?: number;
}

export function buildFolderEntriesPayload(entries: FolderEntry[]) {
  return [...entries]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((entry) => {
      if (entry.entryKind === 'folder') return { entry_kind: 'folder', folder_id: entry.folderId };
      if (entry.entryKind === 'catalog') return { entry_kind: 'catalog', folder_catalog_id: entry.folderCatalogId };
      return { entry_kind: 'source', folder_source_id: entry.folderSourceId };
    });
}

export function eligibleFolderCandidates<T extends FolderCandidate>(folders: T[], selectedFolderId: string): T[] {
  const excluded = new Set([selectedFolderId]);
  let parents = [selectedFolderId];
  while (parents.length > 0) {
    const children = folders.filter((folder) => parents.includes(folder.parent_folder_id ?? ''));
    children.forEach((folder) => excluded.add(folder.id));
    parents = children.map((folder) => folder.id);
  }
  return folders.filter((folder) => !excluded.has(folder.id));
}

/**
 * Uses an explicit cross-kind ordering field when supplied. Without one, the
 * import falls back to each record's supplied sort order, then catalog before
 * source, then its original index within that record kind for stable ties.
 */
export function orderBestImportEntries(entries: BestImportEntry[]): BestImportEntry[] {
  return [...entries].sort((left, right) => {
    const leftOrder = left.unifiedOrder ?? left.sortOrder ?? left.inputIndex;
    const rightOrder = right.unifiedOrder ?? right.sortOrder ?? right.inputIndex;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    if (left.entry.entryKind !== right.entry.entryKind) return left.entry.entryKind.localeCompare(right.entry.entryKind);
    return left.inputIndex - right.inputIndex;
  });
}
