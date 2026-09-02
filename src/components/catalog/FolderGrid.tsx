import type { Collection, Folder } from '../../types';

interface Props {
  collection: Collection;
  folders: Folder[];
  onSelectFolder: (f: Folder) => void;
  onAddFolder: () => void;
  onDragStart: (i: number) => void;
  onDrop: (i: number) => void;
  onMoveUp: (i: number) => void;
  onMoveDown: (i: number) => void;
  onDeleteFolder: (id: string) => void;
  /** A collection is being dragged from the sidebar (not a folder reorder) —
   *  when set, folder tiles become drop targets: dropping one nests that
   *  collection under this folder (parent_folder_id). */
  isCollectionDragActive?: boolean;
  onDropCollectionOntoFolder?: (folderId: string) => void;
}

export function FolderGrid({
  collection, folders, onSelectFolder, onAddFolder, onDragStart, onDrop, onMoveUp, onMoveDown, onDeleteFolder,
  isCollectionDragActive, onDropCollectionOntoFolder,
}: Props) {
  return (
    <div>
      {/* Collection backdrop */}
      <div className="relative mb-6 h-[170px] overflow-hidden rounded-2xl border border-border">
        {collection.backdrop_image ? (
          <img src={collection.backdrop_image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-2 font-mono text-xs text-faint">
            no backdrop_image set
          </div>
        )}
        <div className="absolute inset-0 flex items-end p-5" style={{ background: 'linear-gradient(0deg,rgba(13,6,4,.92),transparent 60%)' }}>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Collection backdrop · backdrop_image</p>
            <h2 className="font-display text-3xl font-extrabold uppercase">{collection.name}</h2>
          </div>
        </div>
      </div>

      <div className="mb-3.5 flex items-center justify-between">
        <h3 className="font-display text-[15px] font-extrabold">
          Folders <span className="font-mono text-xs font-normal text-faint">· click to edit artwork · drag or use ↑↓ to reorder</span>
        </h3>
      </div>

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
        {folders.map((f, i) => {
          // Indices (i) stay tied to the full, unfiltered `folders` array —
          // onDragStart/onDrop/onMoveUp/onMoveDown all key off this index
          // into that array, so a child folder still needs its real i even
          // though it doesn't get its own top-level grid tile below.
          if (f.parent_folder_id) return null;
          const dimmed = f.enabled === false;
          const children = folders.filter((c) => c.parent_folder_id === f.id);
          return (
            <div key={f.id} className={`group relative ${dimmed ? 'opacity-50' : ''}`}>
            {isCollectionDragActive && (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropCollectionOntoFolder?.(f.id); }}
                className="absolute inset-0 z-[5] rounded-2xl border-2 border-dashed border-accent bg-accent-light/30 flex items-center justify-center"
              >
                <span className="rounded-lg bg-bg/90 px-2 py-1 font-mono text-[10px] text-accent">Drop to nest here</span>
              </div>
            )}
            <button
              draggable
              onDragStart={() => onDragStart(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(i)}
              onClick={() => onSelectFolder(f)}
              className="w-full overflow-hidden rounded-2xl border border-border bg-bg2 text-left transition-all hover:-translate-y-1 hover:border-accent"
            >
              <div className="relative flex h-[130px] items-center justify-center overflow-hidden">
                {f.cover_image ? (
                  <img src={f.cover_image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-surface-2" />
                )}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg,rgba(13,6,4,.7),transparent 50%)' }} />
                {f.title_logo && (
                  <img src={f.title_logo} alt="" className="relative z-[2] max-h-[54px] max-w-[78%] object-contain drop-shadow-lg" />
                )}
                <div className="absolute left-2 top-2 z-[3] flex gap-1.5">
                  {f.focus_gif && <Badge tone="magenta">GIF</Badge>}
                  {f.hero_video_url && <Badge tone="cyan">VIDEO</Badge>}
                  {f.title_logo && <Badge>LOGO</Badge>}
                </div>
                {/* position badge */}
                <div className="absolute right-2 bottom-2 z-[3] font-mono text-[10px] text-white/40">#{i + 1}</div>
              </div>
              <div className="flex items-center justify-between p-3">
                <span className="truncate text-[13px] font-semibold text-text">{f.name}</span>
                <span className="font-mono text-[10px] text-faint">{f.tile_shape?.slice(0, 4) || '—'}</span>
              </div>
            </button>

            {/* reorder + delete buttons — visible on hover */}
            <div className="absolute right-2 top-2 z-[4] hidden flex-col gap-1 group-hover:flex">
              <button
                onClick={(e) => { e.stopPropagation(); onMoveUp(i); }}
                disabled={i === 0}
                className="flex h-6 w-6 items-center justify-center rounded-lg bg-bg/80 font-mono text-[11px] text-muted backdrop-blur transition-colors hover:bg-accent hover:text-[#2a1206] disabled:opacity-20"
                title="Move up"
              >↑</button>
              <button
                onClick={(e) => { e.stopPropagation(); onMoveDown(i); }}
                disabled={i === folders.length - 1}
                className="flex h-6 w-6 items-center justify-center rounded-lg bg-bg/80 font-mono text-[11px] text-muted backdrop-blur transition-colors hover:bg-accent hover:text-[#2a1206] disabled:opacity-20"
                title="Move down"
              >↓</button>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteFolder(f.id); }}
                className="flex h-6 w-6 items-center justify-center rounded-lg bg-bg/80 font-mono text-[11px] text-muted backdrop-blur transition-colors hover:bg-red-500 hover:text-white"
                title="Delete folder"
              >×</button>
            </div>

            {/* Nested child folders — shown as a compact list under their
                parent tile so it's visually obvious they're "inside" it,
                not siblings of it. Read-only here (select to edit, same as
                a top-level tile); reordering/deleting a child still happens
                by clicking into it, not from this compact row. */}
            {children.length > 0 && (
              <div className="mt-1.5 space-y-1 rounded-xl border border-dashed border-border/60 bg-bg2/40 p-1.5">
                <p className="px-1 font-mono text-[9px] uppercase tracking-wide text-faint">{children.length} nested folder{children.length === 1 ? '' : 's'}</p>
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => onSelectFolder(child)}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-left transition-colors hover:bg-accent-light/20 ${child.enabled === false ? 'opacity-50' : ''}`}
                  >
                    <span className="truncate text-[11px] text-text">{child.name}</span>
                    <span className="font-mono text-[9px] text-faint">↳</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );})}

        <button
          onClick={onAddFolder}
          className="flex min-h-[178px] items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted transition-colors hover:border-accent hover:text-accent"
        >
          + Add folder
        </button>
      </div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: 'magenta' | 'cyan' }) {
  const toneClass =
    tone === 'magenta' ? 'text-magenta border-magenta/40' : tone === 'cyan' ? 'text-cyan border-cyan/40' : 'text-muted border-border';
  return (
    <span className={`rounded-md border bg-bg/70 px-1.5 py-1 font-mono text-[9px] tracking-wide backdrop-blur ${toneClass}`}>
      {children}
    </span>
  );
}
