import { useCallback, useEffect, useRef, useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { adminKicker, adminLede, adminTitle } from '../../components/admin/AdminUI';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import type { SupportRequest } from '../../types';

type Conversation = SupportRequest & {
  subject?: string | null;
  source?: string;
  device_info?: string | null;
  diagnostics_ref?: string | null;
  last_sender?: 'user' | 'support';
  last_message_at?: string | null;
  user_last_read_at?: string | null;
};

type Message = {
  id: string;
  sender: 'user' | 'support';
  body: string;
  created_at: string;
  email_status?: string | null;
  push_status?: string | null;
};

type Thread = { request: Conversation; messages: Message[] };
type Filter = 'all' | 'waiting' | 'closed';

const TOPIC_LABELS: Record<string, string> = {
  general: 'General', account: 'Account', billing: 'Account & Billing',
  playback: 'Playback', bug: 'Bug', content: 'Missing Content', other: 'Something Else',
};

function conversationStatus(request: Conversation) {
  if (request.status === 'resolved') return 'Closed';
  return request.last_sender === 'support' ? 'Replied' : 'Waiting for us';
}

function displaySubject(request: Conversation) {
  return request.subject?.trim() || request.message.trim().split('\n')[0].slice(0, 100) || TOPIC_LABELS[request.topic] || 'Conversation';
}

function deliveryLabel(status?: string | null) {
  return (status || 'pending').replace(/_/g, ' ');
}

async function support<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('support', { body });
  if (error || data?.error) throw new Error(data?.error || error?.message || 'Could not reach Support');
  return data as T;
}

export default function SupportRequestsPage() {
  const [requests, setRequests] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [delivery, setDelivery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const operation = useRef<{ id: string; body: string; request: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await support<{ requests: Conversation[] }>({ action: 'admin_list' });
      setRequests(result.requests);
      setHasMore(result.requests.length === 100);
      setError('');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadThread = useCallback(async (id: string) => {
    try {
      const result = await support<Thread>({ action: 'thread', id });
      if (selectedRef.current === id) setThread(result);
    } catch (cause) {
      if (selectedRef.current === id) setError((cause as Error).message);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!selected) return;
    void loadThread(selected);
    const timer = window.setInterval(() => { if (!document.hidden) void loadThread(selected); }, 20_000);
    return () => window.clearInterval(timer);
  }, [selected, loadThread]);

  function selectConversation(id: string) {
    if (selected === id) return;
    selectedRef.current = id;
    setSelected(id);
    setThread(null);
    setDraft('');
    setDelivery('');
    setError('');
    operation.current = null;
  }

  async function sendReply() {
    if (!selected || !draft.trim() || busy) return;
    const request = selected;
    const body = draft.trim();
    if (!operation.current || operation.current.body !== body || operation.current.request !== request) {
      operation.current = { id: crypto.randomUUID(), body, request };
    }
    setBusy(true);
    setError('');
    setDelivery('');
    try {
      const result = await support<{ email_status: string; push_status: string }>({
        action: 'reply', id: request, body, message_id: operation.current.id,
      });
      setDraft('');
      operation.current = null;
      setDelivery(`Saved in conversation. Email: ${deliveryLabel(result.email_status)}. Push: ${deliveryLabel(result.push_status)}.`);
      await Promise.all([load(), loadThread(request)]);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(value: 'open' | 'resolved') {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    try {
      await support({ action: 'status', id: selected, status: value });
      await Promise.all([load(), loadThread(selected)]);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function loadMore() {
    setLoading(true);
    try {
      const result = await support<{ requests: Conversation[] }>({ action: 'admin_list', offset: requests.length });
      setRequests(current => [...current, ...result.requests]);
      setHasMore(result.requests.length === 100);
      setError('');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const visible = requests.filter(request => {
    if (filter === 'all') return true;
    if (filter === 'closed') return request.status === 'resolved';
    return conversationStatus(request) === 'Waiting for us';
  });
  const waiting = requests.filter(request => conversationStatus(request) === 'Waiting for us').length;
  const firstMessageStored = thread?.messages.some(message =>
    message.sender === 'user' && message.body === thread.request.message &&
    Math.abs(Date.parse(message.created_at) - Date.parse(thread.request.created_at)) < 5_000,
  );

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={adminKicker}>People</p>
          <h1 className={`mt-2 ${adminTitle}`}>Support</h1>
          <p className={adminLede}>{waiting ? `${waiting} ${waiting === 1 ? 'conversation needs' : 'conversations need'} a reply.` : 'All conversations are answered.'}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void load()} disabled={busy}>Refresh</Button>
      </div>

      {error && <p role="alert" className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

      <div className="grid min-h-[620px] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_80px_rgba(0,0,0,.2)] lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="border-b border-border lg:border-b-0 lg:border-r">
          <div className="flex gap-2 overflow-x-auto border-b border-border p-4">
            {(['all', 'waiting', 'closed'] as Filter[]).map(value => (
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${filter === value ? 'border-accent/50 bg-accent-light text-accent' : 'border-border-strong text-muted hover:text-text'}`}>
                {value}
              </button>
            ))}
          </div>
          {loading && requests.length === 0 && <p className="p-5 text-sm text-muted">Loading conversations…</p>}
          {!loading && visible.length === 0 && <p className="p-5 text-sm text-muted">No conversations here.</p>}
          <div className="max-h-[720px] overflow-y-auto">
            {visible.map(request => (
              <button key={request.id} type="button" disabled={busy} onClick={() => selectConversation(request.id)}
                aria-label={`${request.name}. ${displaySubject(request)}. ${conversationStatus(request)}`}
                className={`block w-full border-b border-border px-5 py-4 text-left transition-colors disabled:opacity-50 ${selected === request.id ? 'bg-surface-2' : 'hover:bg-surface-2/60'}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-text">{request.name}</span>
                  <time className="shrink-0 font-mono text-[10px] text-faint">{new Date(request.last_message_at || request.created_at).toLocaleDateString()}</time>
                </div>
                <p className="mt-1 truncate text-sm text-text">{displaySubject(request)}</p>
                <p className={`mt-2 text-xs ${conversationStatus(request) === 'Waiting for us' ? 'text-accent' : 'text-muted'}`}>
                  {conversationStatus(request)} · {TOPIC_LABELS[request.topic] || request.topic} · {request.source || 'website'}
                </p>
              </button>
            ))}
          </div>
          {hasMore && <Button variant="ghost" size="sm" className="m-4" onClick={() => void loadMore()} loading={loading}>Load more</Button>}
        </aside>

        {!selected ? (
          <div className="grid place-items-center p-8 text-center text-sm text-muted">Select a conversation to read and reply.</div>
        ) : !thread ? (
          <div className="grid place-items-center p-8 text-sm text-muted">Loading conversation…</div>
        ) : (
          <section className="flex min-w-0 flex-col">
            <header className="border-b border-border px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-text">{displaySubject(thread.request)}</h2>
                  <p className="mt-1 text-sm text-muted">{thread.request.name} · {thread.request.email} · {conversationStatus(thread.request)}</p>
                </div>
                <Button variant="ghost" size="sm" loading={busy}
                  onClick={() => void setStatus(thread.request.status === 'resolved' ? 'open' : 'resolved')}>
                  {thread.request.status === 'resolved' ? 'Reopen conversation' : 'Close conversation'}
                </Button>
              </div>
              {thread.request.device_info && <p className="mt-3 text-xs text-faint">{thread.request.device_info}</p>}
              {thread.request.diagnostics_ref && <p className="mt-1 break-all text-xs text-faint">Diagnostics reference: {thread.request.diagnostics_ref}</p>}
              {thread.request.user_last_read_at && <p className="mt-1 text-xs text-faint">Last read in app: {new Date(thread.request.user_last_read_at).toLocaleString()}</p>}
            </header>

            <div aria-label="Conversation messages" className="max-h-[65vh] flex-1 space-y-5 overflow-y-auto bg-bg/35 p-6">
              {!firstMessageStored && (
                <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-border bg-surface-2 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-text">{thread.request.message}</p>
                  <p className="mt-2 text-xs text-faint">{thread.request.name} · {new Date(thread.request.created_at).toLocaleString()}</p>
                </div>
              )}
              {thread.messages.map(message => (
                <div key={message.id} className={`max-w-[88%] rounded-2xl p-4 ${message.sender === 'support' ? 'ml-auto rounded-br-md border border-accent/25 bg-accent-light' : 'rounded-bl-md border border-border bg-surface-2'}`}>
                  {message.sender === 'support' && (
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-text">
                      <img src="/moonlit-icon-96.png" alt="" className="h-7 w-7 rounded-lg" /> Moonlit Support
                    </div>
                  )}
                  <p className="whitespace-pre-wrap text-sm leading-6 text-text">{message.body}</p>
                  <p className="mt-2 text-xs text-faint">{new Date(message.created_at).toLocaleString()}{message.sender === 'support' && ` · Email: ${deliveryLabel(message.email_status)} · Push: ${deliveryLabel(message.push_status)}`}</p>
                </div>
              ))}
            </div>

            <form className="border-t border-border bg-surface p-5" onSubmit={event => { event.preventDefault(); void sendReply(); }}>
              <label htmlFor="support-reply" className="mb-2 block text-sm font-semibold text-text">Reply as Moonlit Support</label>
              <textarea id="support-reply" value={draft} onChange={event => setDraft(event.target.value)} maxLength={5_000} rows={4} disabled={busy} placeholder="Write a reply…"
                className="w-full resize-y rounded-xl border border-border-strong bg-bg2 px-4 py-3 text-sm leading-6 text-text outline-none transition-colors placeholder:text-faint focus:border-accent disabled:opacity-60" />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-muted">Saved in the app, with email and push delivery.</span>
                <Button type="submit" variant="accent" size="sm" loading={busy} disabled={!draft.trim()}>Send reply</Button>
              </div>
              {delivery && <p role="status" className="mt-3 text-sm text-muted">{delivery}</p>}
            </form>
          </section>
        )}
      </div>
    </AppShell>
  );
}
