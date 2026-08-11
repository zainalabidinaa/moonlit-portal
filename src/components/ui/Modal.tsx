import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
  /** When false, there is no way to close the modal except the flow inside it
   *  completing — no backdrop click, no Escape, no X. Used for steps that must
   *  actually happen (e.g. creating the account's first profile) rather than
   *  ones the user can defer. */
  dismissable?: boolean;
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg', dismissable = true }: ModalProps) {
  useEffect(() => {
    if (!open || !dismissable) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, dismissable, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={dismissable ? onClose : undefined} />
      <div className={`relative bg-surface rounded-2xl shadow-xl w-full ${width} max-h-[90vh] overflow-y-auto`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-text">{title}</h2>
            {dismissable && (
              <button onClick={onClose} className="text-muted hover:text-text transition-colors text-xl leading-none">&times;</button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}
