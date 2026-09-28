import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: { invoke },
    from: () => ({
      select: () => ({ order: async () => ({ data: [], error: null }) }),
    }),
  },
}));

vi.mock('../../components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ session: { access_token: 'test-token' } }),
}));

import SupportRequestsPage from './SupportRequestsPage';

const request = {
  id: '93d0e0e4-c704-4d3a-83da-ac266333cbdf',
  user_id: 'account-1',
  name: 'Ada',
  email: 'ada@example.com',
  topic: 'playback',
  message: 'Playback stops after a minute.',
  subject: 'Playback stops',
  status: 'new',
  source: 'app',
  created_at: '2026-09-27T10:00:00Z',
  last_message_at: '2026-09-27T10:00:00Z',
  last_sender: 'user',
  user_last_read_at: null,
  device_info: 'iPhone 17 Pro · iOS 27',
  diagnostics_ref: 'MLD-4F2K',
};

function successfulInvoke(_name: string, { body }: { body: Record<string, unknown> }) {
  if (body.action === 'admin_list') return Promise.resolve({ data: { requests: [request] }, error: null });
  if (body.action === 'thread') return Promise.resolve({ data: { request, messages: [] }, error: null });
  if (body.action === 'reply') {
    return Promise.resolve({ data: { ok: true, email_status: 'sent', push_status: 'not_configured' }, error: null });
  }
  return Promise.resolve({ data: { ok: true }, error: null });
}

describe('admin Support conversation inbox', () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockImplementation(successfulInvoke);
  });

  it('opens an app conversation, replies as Moonlit Support, and shows each delivery result', async () => {
    const user = userEvent.setup();
    render(<SupportRequestsPage />);

    await user.click(await screen.findByRole('button', { name: /Ada.*Playback stops/i }));
    expect(await screen.findByText('Playback stops after a minute.')).toBeInTheDocument();
    expect(screen.getByText(/Diagnostics reference: MLD-4F2K/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Reply as Moonlit Support'), 'Please try again.');
    await user.click(screen.getByRole('button', { name: 'Send reply' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Email: sent');
    expect(screen.getByRole('status')).toHaveTextContent('Push: not configured');
    expect(invoke).toHaveBeenCalledWith('support', {
      body: expect.objectContaining({
        action: 'reply',
        id: request.id,
        body: 'Please try again.',
        message_id: expect.any(String),
      }),
    });
  });

  it('keeps the draft and idempotency key when a send fails and is retried', async () => {
    const user = userEvent.setup();
    render(<SupportRequestsPage />);
    await user.click(await screen.findByRole('button', { name: /Ada.*Playback stops/i }));
    await user.type(await screen.findByLabelText('Reply as Moonlit Support'), 'Try again.');

    invoke.mockImplementationOnce(async () => ({ data: null, error: { message: 'Offline' } }));
    await user.click(screen.getByRole('button', { name: 'Send reply' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Offline');
    expect(screen.getByLabelText('Reply as Moonlit Support')).toHaveValue('Try again.');

    await user.click(screen.getByRole('button', { name: 'Send reply' }));
    await waitFor(() => expect(screen.getByLabelText('Reply as Moonlit Support')).toHaveValue(''));
    const sends = invoke.mock.calls.filter(call => call[1].body.action === 'reply');
    expect(sends[0][1].body.message_id).toBe(sends[1][1].body.message_id);
  });

  it('does not blank the thread when the selected conversation is clicked again', async () => {
    const user = userEvent.setup();
    render(<SupportRequestsPage />);
    const row = await screen.findByRole('button', { name: /Ada.*Playback stops/i });
    await user.click(row);
    expect(await screen.findByLabelText('Conversation messages')).toBeInTheDocument();
    await user.click(row);
    expect(screen.getByLabelText('Conversation messages')).toBeInTheDocument();
  });
});
