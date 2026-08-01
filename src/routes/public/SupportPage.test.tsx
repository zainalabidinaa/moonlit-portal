import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// hoisted so the vi.mock factory below can reach them at module-init time
const { insert, invoke } = vi.hoisted(() => ({ insert: vi.fn(), invoke: vi.fn() }));

// A bare insert(...) — deliberately NOT insert(...).select().single().
// RLS grants anon INSERT but no SELECT policy covers it, so a RETURNING clause
// aborts the whole statement with 42501 for logged-out visitors. Mocking the
// bare call keeps that constraint enforced: reintroduce .select() and this
// mock throws rather than quietly passing.
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ insert: (row: unknown) => insert(row) }),
    functions: { invoke },
    auth: { signOut: vi.fn() },
  },
}));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ session: null, role: null, activeProfile: null }),
}));

import SupportPage from './SupportPage';

function setup() {
  return render(
    <MemoryRouter>
      <SupportPage />
    </MemoryRouter>
  );
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/your name/i), 'Ada Lovelace');
  await user.type(screen.getByLabelText(/^email$/i), 'ada@example.com');
  await user.type(screen.getByLabelText(/message/i), 'Playback stops after a minute on Apple TV.');
}

describe('SupportPage', () => {
  beforeEach(() => {
    insert.mockReset();
    invoke.mockReset();
    insert.mockResolvedValue({ error: null });
    invoke.mockResolvedValue({ data: { sent: true }, error: null });
  });

  it('shows the support email and a contact form', () => {
    setup();
    expect(screen.getByRole('heading', { name: /send a message/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /hey@trymoonlit\.app/i }).length).toBeGreaterThan(0);
  });

  it('rejects an empty submission without hitting the database', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(insert).not.toHaveBeenCalled();
    expect(screen.getByText(/tell us who you are/i)).toBeInTheDocument();
  });

  it('rejects a malformed email address', async () => {
    const user = userEvent.setup();
    setup();

    await user.type(screen.getByLabelText(/your name/i), 'Ada');
    await user.type(screen.getByLabelText(/^email$/i), 'not-an-email');
    await user.type(screen.getByLabelText(/message/i), 'Something is broken here.');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(insert).not.toHaveBeenCalled();
    expect(screen.getByText(/does not look right/i)).toBeInTheDocument();
  });

  it('saves the request and confirms it was sent', async () => {
    const user = userEvent.setup();
    setup();

    await fillForm(user);
    await user.selectOptions(screen.getByLabelText(/topic/i), 'billing');
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(insert).toHaveBeenCalledWith({
      id: expect.stringMatching(UUID_RE),
      user_id: null,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      topic: 'billing',
      message: 'Playback stops after a minute on Apple TV.',
    });
    expect(await screen.findByRole('heading', { name: /message sent/i })).toBeInTheDocument();
  });

  it('asks the notify function to email the stored request', async () => {
    const user = userEvent.setup();
    setup();

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByRole('heading', { name: /message sent/i })).toBeInTheDocument();
    const row = insert.mock.calls[0][0] as { id: string };
    expect(invoke).toHaveBeenCalledWith('support-notify', { body: { id: row.id } });
  });

  // Regression guard for the 42501 outage: the contact page is public, and RLS
  // lets anon write but never read. The id therefore has to come from the
  // client, so the insert never needs a RETURNING clause.
  it('generates the request id client-side so an anonymous insert needs no read-back', async () => {
    const user = userEvent.setup();
    setup();

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /send message/i }));

    const row = insert.mock.calls[0][0] as { id: string };
    expect(row.id).toMatch(UUID_RE);
  });

  it('still confirms the message when the email notification fails', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'resend down' } });
    const user = userEvent.setup();
    setup();

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /send message/i }));

    // The request is saved either way, so the visitor must not be told to retry.
    expect(await screen.findByRole('heading', { name: /message sent/i })).toBeInTheDocument();
    expect(screen.queryByText(/could not send that/i)).not.toBeInTheDocument();
  });

  it('falls back to the email address when the insert fails', async () => {
    insert.mockResolvedValue({ data: null, error: { message: 'nope' } });
    const user = userEvent.setup();
    setup();

    await fillForm(user);
    await user.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText(/could not send that/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /message sent/i })).not.toBeInTheDocument();
  });
});
