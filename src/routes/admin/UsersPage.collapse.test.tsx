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

it('opens details under the row and closes them via the toggle, row and Close button', async () => {
  render(<UsersPage />);
  const details = { name: 'Details for example@example.com' };
  const expand = await screen.findByRole('button', { name: 'Expand options for example@example.com' });

  // Nothing opens on its own.
  expect(expand).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('region', details)).toBeNull();

  fireEvent.click(expand);
  expect(screen.getByRole('region', details)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Collapse options for example@example.com' }));
  expect(screen.queryByRole('region', details)).toBeNull();

  const row = screen.getByRole('row', { name: /example@example.com/ });
  fireEvent.click(row);
  expect(screen.getByRole('region', details)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('region', details)).toBeNull();

  fireEvent.click(row);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByRole('button', { name: 'Collapse options for example@example.com' })).toHaveAttribute('aria-expanded', 'true');
  // The list re-renders on refresh, so find the row again.
  fireEvent.click(screen.getAllByRole('row', { name: /example@example.com/ })[0]);
  expect(screen.queryByRole('region', details)).toBeNull();
});
