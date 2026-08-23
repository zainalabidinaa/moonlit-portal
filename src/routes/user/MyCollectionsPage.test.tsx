import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../lib/personalCollections', () => ({
  listPersonalCollections: vi.fn(),
  createPersonalCollection: vi.fn(),
  deletePersonalCollection: vi.fn(),
  listFolders: vi.fn(() => Promise.resolve([])),
  createFolder: vi.fn(),
  deleteFolder: vi.fn(),
  listCatalogSources: vi.fn(() => Promise.resolve([])),
  addCatalogSource: vi.fn(),
  deleteCatalogSource: vi.fn(),
}));
vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }) }) },
}));

import { useAuth } from '../../context/AuthContext';
import { listPersonalCollections } from '../../lib/personalCollections';
import MyCollectionsPage from './MyCollectionsPage';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const mockList = listPersonalCollections as ReturnType<typeof vi.fn>;

beforeEach(() => { vi.clearAllMocks(); });

describe('MyCollectionsPage', () => {
  it('tells non-eligible roles the feature is unavailable', () => {
    mockUseAuth.mockReturnValue({ role: 'premium', activeProfile: { id: 'p1' } });
    mockList.mockResolvedValue([]);
    render(<MyCollectionsPage />);
    expect(screen.getByText(/only available on Premium\+/i)).toBeInTheDocument();
  });

  it('lists the profile’s own collections for premium_plus', async () => {
    mockUseAuth.mockReturnValue({ role: 'premium_plus', activeProfile: { id: 'p1' } });
    mockList.mockResolvedValue([{ id: 'c1', name: 'Weekend Picks' }]);
    render(<MyCollectionsPage />);
    await waitFor(() => expect(screen.getByText('Weekend Picks')).toBeInTheDocument());
    expect(mockList).toHaveBeenCalledWith('p1');
  });
});
