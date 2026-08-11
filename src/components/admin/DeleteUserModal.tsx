import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface DeleteUserModalProps {
  open: boolean;
  onClose: () => void;
  userEmail: string;
  onConfirm: () => Promise<void>;
}

/**
 * Deliberately the same friction GitHub uses for deleting a repo: the delete
 * button stays disabled until the admin has typed the account's exact email,
 * plus a separate checkbox acknowledging it's permanent. Two independent
 * actions, neither satisfiable by a stray click or an autofill.
 *
 * This is UI friction only — the server enforces the same match on
 * `confirmEmail` independently (see the admin-users DELETE handler), so
 * bypassing this component doesn't bypass the check.
 */
export function DeleteUserModal({ open, onClose, userEmail, onConfirm }: DeleteUserModalProps) {
  const [typedEmail, setTypedEmail] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const canDelete = typedEmail.trim().toLowerCase() === userEmail.toLowerCase() && acknowledged;

  function handleClose() {
    if (deleting) return;
    setTypedEmail('');
    setAcknowledged(false);
    setError('');
    onClose();
  }

  async function handleDelete() {
    if (!canDelete) return;
    setDeleting(true);
    setError('');
    try {
      await onConfirm();
      handleClose();
    } catch (e) {
      setError((e as Error).message || 'Failed to delete account');
      setDeleting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Delete account">
      <div className="p-6 flex flex-col gap-4">
        <p className="text-sm text-text">
          This permanently deletes <span className="font-semibold">{userEmail}</span> — their login,
          every profile on the account, watch history, addons, and lists. There is no undo.
        </p>

        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">
            Type <span className="font-mono text-text">{userEmail}</span> to confirm
          </label>
          <input
            type="text"
            value={typedEmail}
            onChange={e => setTypedEmail(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
            placeholder="Email address"
          />
        </div>

        <label className="flex items-start gap-2 text-sm text-text cursor-pointer select-none">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={e => setAcknowledged(e.target.checked)}
            className="mt-0.5 accent-accent"
          />
          I understand this cannot be undone.
        </label>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={handleClose} disabled={deleting}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} disabled={!canDelete} loading={deleting}>
            Delete account
          </Button>
        </div>
      </div>
    </Modal>
  );
}
