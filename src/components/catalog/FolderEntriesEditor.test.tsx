import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FolderEntriesEditor } from './FolderEntriesEditor';

describe('FolderEntriesEditor', () => {
  it('saves a mixed list in its new order after dropping an entry', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <FolderEntriesEditor
        entries={[
          { entryKind: 'folder', folderId: 'franchises', sortOrder: 0, label: 'Horror Franchises' },
          { entryKind: 'catalog', folderCatalogId: 'catalog-1', sortOrder: 1, label: 'Popular Horror' },
        ]}
        onSave={onSave}
      />,
    );

    fireEvent.dragStart(screen.getByText('Popular Horror'));
    fireEvent.drop(screen.getByText('Horror Franchises'));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith([
      { entryKind: 'catalog', folderCatalogId: 'catalog-1', sortOrder: 0 },
      { entryKind: 'folder', folderId: 'franchises', sortOrder: 1 },
    ]));
  });

  it('restores the last confirmed order and shows an error when saving fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Unable to save order'));

    render(
      <FolderEntriesEditor
        entries={[
          { entryKind: 'folder', folderId: 'franchises', sortOrder: 0, label: 'Horror Franchises' },
          { entryKind: 'catalog', folderCatalogId: 'catalog-1', sortOrder: 1, label: 'Popular Horror' },
        ]}
        onSave={onSave}
      />,
    );

    fireEvent.dragStart(screen.getByText('Popular Horror'));
    fireEvent.drop(screen.getByText('Horror Franchises'));

    expect(await screen.findByText('Unable to save order')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Horror Franchises'),
      expect.stringContaining('Popular Horror'),
    ]);
  });

  it('moves an existing folder into the current folder', async () => {
    const onMoveFolderHere = vi.fn().mockResolvedValue(undefined);

    render(
      <FolderEntriesEditor
        entries={[]}
        onSave={vi.fn().mockResolvedValue(undefined)}
        movableFolders={[{ id: 'international', label: 'International Horror' }]}
        onMoveFolderHere={onMoveFolderHere}
      />,
    );

    fireEvent.change(screen.getByLabelText('Move existing folder here'), { target: { value: 'international' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move here' }));

    await waitFor(() => expect(onMoveFolderHere).toHaveBeenCalledWith('international'));
  });
});
