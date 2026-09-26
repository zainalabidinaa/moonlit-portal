import {
  applyQuickPreset,
  buildFilteringQuery,
  filteringValidationMessage,
  genresFor,
  filteringSummary,
  ORDERING_OPTIONS,
  orderingSeedsVoteCount,
  STATUS_OPTIONS,
  type FilteringMediaKind,
  type FilteringPeriod,
  type FilteringReleaseStatus,
  type FilteringState,
} from '../../lib/filteringQuery'

/**
 * The portal's own editor for "Filtering" widgets — the facets the app's
 * filter builder exposes, authored here and written as the same TMDB query
 * string the app already resolves (`WidgetContentResolver.resolveFiltering`).
 *
 * Until now these rows were read-only in the portal ("filters are edited
 * on-device"), which meant a preset couldn't be authored end-to-end without
 * opening the app. Everything here maps 1:1 onto the app's vocabulary:
 * ordering (including the `trending.day|week` sentinel), genres, a period
 * window, release status, rating/vote floors, runtime, language and the row
 * cap.
 */

const inputClass =
  'w-full rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text focus:border-accent focus:outline-none'

const PERIODS: { value: FilteringPeriod; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'toPresent', label: 'To Present' },
  { value: 'y2020s', label: '2020s' },
  { value: 'y2010s', label: '2010s' },
  { value: 'y2000s', label: '2000s' },
  { value: 'y1990s', label: '90s' },
  { value: 'y1980s', label: '80s' },
  { value: 'classic', label: 'Classic' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'custom', label: 'Custom' },
]

const RELEASE_STATUSES: { value: FilteringReleaseStatus; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'released', label: 'Released' },
  { value: 'upcoming', label: 'Upcoming' },
]

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-border text-muted hover:border-border-strong hover:text-text'
      }`}
    >
      {label}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-faint">{label}</span>
      {children}
    </label>
  )
}

export function FilteringWidgetFields({
  value,
  onChange,
}: {
  value: FilteringState
  onChange: (next: FilteringState) => void
}) {
  const set = (patch: Partial<FilteringState>) => onChange({ ...value, ...patch })
  const genres = genresFor(value.mediaKind)
  const query = buildFilteringQuery(value)
  const validation = filteringValidationMessage(value)

  return (
    <div className="flex flex-col gap-4">
      {validation && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          {validation}
        </p>
      )}
      <Field label="Content type">
        <div className="flex gap-1.5">
          {(['movie', 'series'] as FilteringMediaKind[]).map((kind) => (
            <Chip
              key={kind}
              active={value.mediaKind === kind}
              label={kind === 'movie' ? 'Movies' : 'Series'}
              onClick={() =>
                set({
                  mediaKind: kind,
                  // Genre ids differ between the two lists; keeping a tv-only
                  // id on a movie row (or the reverse) silently matches
                  // nothing, so a switch clears the selection.
                  genreIds: [],
                  releaseStatus: kind === 'series' ? 'any' : value.releaseStatus,
                  // TV-only facets and the movie/TV-only curated lists.
                  status: kind === 'movie' ? '' : value.status,
                  airDateFrom: kind === 'movie' ? '' : value.airDateFrom,
                  airDateTo: kind === 'movie' ? '' : value.airDateTo,
                  ordering: ORDERING_OPTIONS.find((o) => o.value === value.ordering)?.kinds.includes(kind)
                    ? value.ordering
                    : 'popular',
                })
              }
            />
          ))}
        </div>
      </Field>

      <Field label="Ordering">
        <div className="flex flex-wrap gap-1.5">
          {ORDERING_OPTIONS.filter((o) => o.kinds.includes(value.mediaKind)).map((ordering) => (
            <Chip
              key={ordering.value}
              active={value.ordering === ordering.value}
              label={ordering.label}
              onClick={() =>
                set({
                  ordering: ordering.value,
                  // Seeded into the visible field so it can be cleared: a bare
                  // "Top Rated"/"Newest" is a wall of two-vote 10/10s or
                  // whatever shipped that day.
                  ...(orderingSeedsVoteCount(ordering.value) && !value.minVotes.trim()
                    ? { minVotes: orderingSeedsVoteCount(ordering.value)! }
                    : {}),
                })
              }
            />
          ))}
        </div>
        <p className="text-[11px] text-faint">
          “Trending Today/This Week”, “Now Playing”, “Currently Airing” and “Airing Today” are
          TMDB&apos;s own curated lists. They take no filters: only the period, the next air-date
          window and the row limit apply — genres, keywords, rating and vote floors are ignored
          for those orderings.
        </p>
      </Field>

      <Field label="Quick presets">
        <div className="flex flex-wrap gap-1.5">
          <Chip
            active={false}
            label="New Series"
            onClick={() => onChange(applyQuickPreset(value, 'newSeries'))}
          />
          <Chip
            active={false}
            label="Returning This Week"
            onClick={() => onChange(applyQuickPreset(value, 'returningThisWeek'))}
          />
        </div>
        <p className="text-[11px] text-faint">
          New Series = newest-first over the last 60 days · Returning This Week = Returning
          status with a next-air-date window of today → +7 days.
        </p>
      </Field>

      <Field label={`Genres${value.genreIds.length ? ` · ${value.genreIds.length}` : ''}`}>
        <div className="flex flex-wrap gap-1.5">
          {genres.map((genre) => {
            const active = value.genreIds.includes(genre.id)
            return (
              <Chip
                key={genre.id}
                active={active}
                label={genre.name}
                onClick={() =>
                  set({
                    genreIds: active
                      ? value.genreIds.filter((id) => id !== genre.id)
                      : [...value.genreIds, genre.id],
                  })
                }
              />
            )
          })}
        </div>
      </Field>

      <Field label="Period">
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((period) => (
            <Chip
              key={period.value}
              active={value.period === period.value}
              label={period.label}
              onClick={() => set({ period: period.value })}
            />
          ))}
        </div>
        {value.period === 'custom' && (
          <div className="mt-1 flex items-center gap-2">
            <input
              type="date"
              value={value.customFrom}
              onChange={(e) => set({ customFrom: e.target.value })}
              className={inputClass}
            />
            <span className="text-xs text-faint">to</span>
            <input
              type="date"
              value={value.customTo}
              onChange={(e) => set({ customTo: e.target.value })}
              className={inputClass}
            />
          </div>
        )}
        <p className="text-[11px] text-faint">
          “Upcoming” keeps future-dated titles; every other window hides them.
        </p>
      </Field>

      {value.mediaKind === 'series' && (
        <Field label="Status">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                active={value.status === option.value}
                label={option.label}
                onClick={() => set({ status: option.value })}
              />
            ))}
          </div>
        </Field>
      )}

      {value.mediaKind === 'series' && (
        <Field label="Next air date">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={value.airDateFrom}
              onChange={(e) => set({ airDateFrom: e.target.value })}
              className={inputClass}
            />
            <span className="text-xs text-faint">to</span>
            <input
              type="date"
              value={value.airDateTo}
              onChange={(e) => set({ airDateTo: e.target.value })}
              className={inputClass}
            />
          </div>
          <p className="text-[11px] text-faint">
            For returning shows: when the next episode airs. “Returning This Week” seeds this.
          </p>
        </Field>
      )}

      {value.mediaKind === 'movie' && (
        <Field label="Release status">
          <div className="flex gap-1.5">
            {RELEASE_STATUSES.map((status) => (
              <Chip
                key={status.value}
                active={value.releaseStatus === status.value}
                label={status.label}
                onClick={() => set({ releaseStatus: status.value })}
              />
            ))}
          </div>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Min rating">
          <input
            value={value.minRating}
            onChange={(e) => set({ minRating: e.target.value })}
            className={inputClass}
            placeholder="e.g. 7"
            inputMode="decimal"
          />
        </Field>
        <Field label="Min votes">
          <input
            value={value.minVotes}
            onChange={(e) => set({ minVotes: e.target.value })}
            className={inputClass}
            placeholder="e.g. 100"
            inputMode="numeric"
          />
        </Field>
        <Field label="Runtime from (min)">
          <input
            value={value.runtimeMin}
            onChange={(e) => set({ runtimeMin: e.target.value })}
            className={inputClass}
            placeholder="e.g. 30"
            inputMode="numeric"
          />
        </Field>
        <Field label="Runtime to (min)">
          <input
            value={value.runtimeMax}
            onChange={(e) => set({ runtimeMax: e.target.value })}
            className={inputClass}
            placeholder="e.g. 180"
            inputMode="numeric"
          />
        </Field>
        <Field label="Original language">
          <input
            value={value.language}
            onChange={(e) => set({ language: e.target.value })}
            className={inputClass}
            placeholder="e.g. en, ar, ja"
          />
        </Field>
        <Field label="Max items in the row">
          <input
            value={value.limit}
            onChange={(e) => set({ limit: e.target.value })}
            className={inputClass}
            placeholder="No limit"
            inputMode="numeric"
          />
        </Field>
      </div>

      <div className="rounded-xl border border-border px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">Preview</p>
        <p className="mt-1 text-sm text-text">{filteringSummary(query)}</p>
        <p className="mt-2 break-words font-mono text-[11px] leading-relaxed text-faint">{query}</p>
      </div>
    </div>
  )
}
