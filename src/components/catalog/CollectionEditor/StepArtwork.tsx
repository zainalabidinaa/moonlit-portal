import { Input } from '../../../components/ui/Input';
import type { Collection } from '../../../types';

type Draft = Partial<Collection> & { name: string };

export function StepArtwork({ draft, onChange }: { draft: Draft; onChange: (d: Draft) => void }) {
  const hasImage = !!draft.backdrop_image;

  return (
    <div className="flex flex-col gap-5">
      {/* Backdrop preview */}
      <div className="w-full h-40 rounded-xl overflow-hidden bg-surface-2 border border-border flex items-center justify-center relative">
        {hasImage ? (
          <img src={draft.backdrop_image!} alt="Backdrop preview" className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs">No backdrop set</span>
          </div>
        )}
        {hasImage && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
            <span className="text-xs text-white/80 truncate max-w-full">{draft.backdrop_image}</span>
          </div>
        )}
      </div>

      <Input
        id="backdrop"
        label="Backdrop Image URL"
        type="url"
        value={draft.backdrop_image ?? ''}
        onChange={e => onChange({ ...draft, backdrop_image: e.target.value || null })}
        placeholder="https://image.tmdb.org/t/p/original/..."
      />

      <div>
        <p className="text-sm font-medium text-text mb-2">View Mode</p>
        <div className="flex gap-2">
          {['FOLLOW_LAYOUT', 'GRID', 'LIST'].map(mode => (
            <button
              key={mode}
              onClick={() => onChange({ ...draft, view_mode: mode })}
              className={`flex-1 py-2 text-xs rounded-lg border transition-colors cursor-pointer ${
                draft.view_mode === mode
                  ? 'border-accent bg-accent-light text-accent'
                  : 'border-border text-muted hover:border-accent/40'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
