import { fireEvent, render, screen } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import UsersPage from './UsersPage';

vi.mock('../../context/AuthContext', () => {
  const session = {};
  return { useAuth: () => ({ session }) };
});
vi.mock('../../components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../lib/authed-fetch', () => ({
  SessionExpiredError: class extends Error {},
  authedFetchJson: async (url: string) => url.includes('?activity=') ? {} : {
    users: [{
      id: 'record-1',
      user_id: 'user-1',
      email: 'example@example.com',
      role: 'free',
      role_expires_at: null,
      created_at: '2026-01-01T00:00:00Z',
    }],
  },
}));

it('closes via the row toggle and panel button, and stays closed after refresh', async () => {
  render(<UsersPage />);
  const panel = { name: 'Details for example@example.com' };
  const expand = { name: 'Expand options for example@example.com' };
  const collapse = await screen.findByRole('button', { name: 'Collapse options for example@example.com' });

  fireEvent.click(collapse);
  expect(screen.queryByRole('complementary', panel)).toBeNull();

  fireEvent.click(screen.getByRole('button', expand));
  expect(screen.getByRole('complementary', panel)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByRole('button', expand)).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('complementary', panel)).toBeNull();

  const row = screen.getByRole('row', { name: /example@example.com/ });
  fireEvent.click(row);
  expect(screen.getByRole('complementary', panel)).toBeInTheDocument();
  fireEvent.click(row);
  expect(screen.queryByRole('complementary', panel)).toBeNull();
});
