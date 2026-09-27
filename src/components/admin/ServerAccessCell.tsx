import { useState } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { GRANT_PRESETS, serverAccessState, type ServerAccessFields, type ServerAccessKind } from '../../lib/serverAccess';

const VARIANT: Record<ServerAccessKind, 'default' | 'success' | 'warning' | 'danger' | 'purple'> = {
  manual: 'warning',
  subscription: 'purple',
  store: 'success',
  expired: 'danger',
  none: 'default',
};

interface Props {
  user: ServerAccessFields;
  busy: boolean;
  onGrant: (preset: string) => Promise<void>;
  onRevoke: () => Promise<void>;
}

export function ServerAccessCell({ user, busy, onGrant, onRevoke }: Props) {
  const [picking, setPicking] = useState(false);
  const [preset, setPreset] = useState('30d');
  const state = serverAccessState(user);
  const isAdmin = user.role === 'admin';
  const grantLabel = state.kind === 'manual' ? 'Change' : state.kind === 'none' || state.kind === 'expired' ? 'Grant' : 'Extend';

  return (
    <div className="flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <Badge variant={VARIANT[state.kind]}>{state.label}</Badge>
        {!isAdmin && !picking && (
          <>
            <button
              className="text-xs text-accent hover:underline disabled:opacity-50"
              disabled={busy}
              onClick={() => setPicking(true)}
            >
              {grantLabel}
            </button>
            {state.kind === 'manual' && (
              <button className="text-xs text-red-400 hover:underline disabled:opacity-50" disabled={busy} onClick={onRevoke}>
                Revoke
              </button>
            )}
          </>
        )}
      </div>
      {state.detail && <span className="text-xs text-muted">{state.detail}</span>}
      {picking && (
        <div className="flex items-center gap-1.5">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className="h-8 rounded-lg border border-border-strong bg-bg2 px-2.5 text-xs text-text outline-none transition-colors focus:border-accent disabled:opacity-50"
          >
            {GRANT_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <Button
            size="sm"
            loading={busy}
            onClick={async () => {
              await onGrant(preset);
              setPicking(false);
            }}
          >
            Grant
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPicking(false)}>Cancel</Button>
        </div>
      )}
    </div>
  );
}
