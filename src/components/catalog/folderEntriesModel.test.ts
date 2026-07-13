import { describe, expect, it } from 'vitest';
import { buildFolderEntriesPayload, eligibleFolderCandidates } from './folderEntriesModel';

describe('folder entries model', () => {
  it('builds an ordered RPC payload while retaining existing child-folder entries', () => {
    expect(buildFolderEntriesPayload([
      { entryKind: 'source', folderSourceId: 'source-1', sortOrder: 2 },
      { entryKind: 'folder', folderId: 'child-folder', sortOrder: 0 },
      { entryKind: 'catalog', folderCatalogId: 'catalog-1', sortOrder: 1 },
    ])).toEqual([
      { entry_kind: 'folder', folder_id: 'child-folder' },
      { entry_kind: 'catalog', folder_catalog_id: 'catalog-1' },
      { entry_kind: 'source', folder_source_id: 'source-1' },
    ]);
  });

  it('offers every collection folder except the selected folder and its descendants', () => {
    const folders = [
      { id: 'horror', parent_folder_id: null, name: 'Horror' },
      { id: 'franchises', parent_folder_id: 'horror', name: 'Horror Franchises' },
      { id: 'scream', parent_folder_id: 'franchises', name: 'Scream' },
      { id: 'international', parent_folder_id: null, name: 'International Horror' },
      { id: 'thriller', parent_folder_id: 'international', name: 'Thriller' },
    ];

    expect(eligibleFolderCandidates(folders, 'horror').map((folder) => folder.id)).toEqual([
      'international',
      'thriller',
    ]);
  });
});
