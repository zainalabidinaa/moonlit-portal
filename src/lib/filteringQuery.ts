/**
 * TMDB filter queries for "Filtering" preset widgets, authored in the portal.
 *
 * The vocabulary is the app's own (see `TMDBFilterBuilderView` and
 * `WidgetContentResolver.resolveFiltering`): a URL-encoded `/discover` param
 * string plus two builder-only sentinels — `sort_by=trending.day|week`, which
 * the app routes to TMDB's dedicated `/trending` endpoint (discover has no
 * trending sort), and `limit=N`, which caps the row.
 *
 * Values are percent-encoded with `encodeURIComponent` rather than
 * `URLSearchParams.toString()`: the latter writes spaces as `+`, and the
 * app decodes with `removingPercentEncoding`, which leaves `+` alone.
 */

export type FilteringMediaKind = 'movie' | 'series'

export type FilteringOrdering =
  | 'popular'
  | 'trendingDay'
  | 'trendingWeek'
  | 'topRated'
  | 'newest'
  | 'oldest'
  | 'revenue'

export type FilteringPeriod =
  | 'any'
  | 'toPresent'
  | 'y2020s'
  | 'y2010s'
  | 'y2000s'
  | 'y1990s'
  | 'y1980s'
  | 'classic'
  | 'upcoming'
  | 'custom'

export type FilteringReleaseStatus = 'any' | 'released' | 'upcoming'

export interface FilteringState {
  mediaKind: FilteringMediaKind
  ordering: FilteringOrdering
  genreIds: number[]
  period: FilteringPeriod
  customFrom: string
  customTo: string
  releaseStatus: FilteringReleaseStatus
  minRating: string
  minVotes: string
  runtimeMin: string
  runtimeMax: string
  language: string
  limit: string
}

export const DEFAULT_FILTERING_STATE: FilteringState = {
  mediaKind: 'movie',
  ordering: 'popular',
  genreIds: [],
  period: 'any',
  customFrom: '',
  customTo: '',
  releaseStatus: 'any',
  minRating: '',
  minVotes: '',
  runtimeMin: '',
  runtimeMax: '',
  language: '',
  limit: '',
}

export const MOVIE_GENRES: { id: number; name: string }[] = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Science Fiction' },
  { id: 10770, name: 'TV Movie' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
]

export const TV_GENRES: { id: number; name: string }[] = [
  { id: 10759, name: 'Action & Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 10762, name: 'Kids' },
  { id: 9648, name: 'Mystery' },
  { id: 10763, name: 'News' },
  { id: 10764, name: 'Reality' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 10766, name: 'Soap' },
  { id: 10767, name: 'Talk' },
  { id: 10768, name: 'War & Politics' },
  { id: 37, name: 'Western' },
]

export function genresFor(kind: FilteringMediaKind) {
  return kind === 'series' ? TV_GENRES : MOVIE_GENRES
}

/** The floor `orderingSeedsVoteCount` installs. */
export const SEEDED_VOTE_FLOOR = '100'

/**
 * A bare `vote_average.desc` is a wall of two-vote 10/10s and a bare
 * `primary_release_date.desc` is whatever released that day, so picking one of
 * those orderings seeds a vote floor — into the visible field, so it can be
 * cleared. Trending is excluded: TMDB's trending endpoint ignores vote floors.
 */
export function orderingSeedsVoteCount(ordering: FilteringOrdering): string | null {
  return ordering === 'topRated' || ordering === 'newest' || ordering === 'oldest'
    ? SEEDED_VOTE_FLOOR
    : null
}

/** A combination that can only ever return nothing, surfaced before saving. */
export function filteringValidationMessage(state: FilteringState): string | null {
  if (state.period === 'upcoming' && state.releaseStatus === 'released') {
    return 'Upcoming period with Released status can never match anything — pick one or the other.'
  }
  return null
}

function todayString(today?: string): string {
  if (today) return today
  const now = new Date()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function dateKey(kind: FilteringMediaKind): string {
  return kind === 'series' ? 'first_air_date' : 'primary_release_date'
}

function periodWindow(
  state: FilteringState,
  today: string,
): { from?: string; to?: string } {
  const year = Number(today.slice(0, 4))
  switch (state.period) {
    case 'any':
      return {}
    case 'toPresent':
      return { from: '1900-01-01', to: today }
    case 'y2020s':
      return { from: '2020-01-01', to: '2029-12-31' }
    case 'y2010s':
      return { from: '2010-01-01', to: '2019-12-31' }
    case 'y2000s':
      return { from: '2000-01-01', to: '2009-12-31' }
    case 'y1990s':
      return { from: '1990-01-01', to: '1999-12-31' }
    case 'y1980s':
      return { from: '1980-01-01', to: '1989-12-31' }
    case 'classic':
      return { from: '1900-01-01', to: '1979-12-31' }
    case 'upcoming':
      // `gte` with no `lte` is the app's "Upcoming" intent — the one case
      // where it does not hide future-dated titles.
      return { from: today }
    case 'custom':
      return {
        ...(state.customFrom ? { from: state.customFrom } : {}),
        ...(state.customTo ? { to: state.customTo } : {}),
      }
    default:
      return {}
  }
  void year
}

function orderingValue(state: FilteringState): string {
  switch (state.ordering) {
    case 'popular':
      return 'popularity.desc'
    case 'topRated':
      return 'vote_average.desc'
    case 'newest':
      return state.mediaKind === 'series' ? 'first_air_date.desc' : 'primary_release_date.desc'
    case 'oldest':
      return state.mediaKind === 'series' ? 'first_air_date.asc' : 'primary_release_date.asc'
    case 'revenue':
      return state.mediaKind === 'series' ? 'popularity.desc' : 'revenue.desc'
    case 'trendingDay':
      return 'trending.day'
    case 'trendingWeek':
      return 'trending.week'
    default:
      return 'popularity.desc'
  }
}

/** The row's TMDB query. Empty-ish states fall back to `popularity.desc`. */
export function buildFilteringQuery(state: FilteringState, today?: string): string {
  const now = todayString(today)
  const params: [string, string][] = [['sort_by', orderingValue(state)]]

  if (state.genreIds.length) {
    params.push(['with_genres', [...state.genreIds].sort((a, b) => a - b).join(',')])
  }

  const window = periodWindow(state, now)
  const key = dateKey(state.mediaKind)
  if (window.from) params.push([`${key}.gte`, window.from])
  if (window.to) params.push([`${key}.lte`, window.to])

  // Release status only narrows movies; TMDB has no equivalent for series.
  //
  // `with_release_type` is ignored unless it is paired with a
  // `release_date.*` window (the app used to pair it with
  // `primary_release_date.*`, which made the option a silent no-op — verified
  // live: with release_date the same query went 3 → 1 → 0 results, with
  // primary_release_date it stayed unchanged). The Period window above stays
  // on the primary date, which is what it means.
  if (state.mediaKind === 'movie' && state.releaseStatus !== 'any') {
    params.push(['with_release_type', '2|3|4'])
    if (state.releaseStatus === 'released' && !window.to) {
      params.push(['release_date.lte', now])
    }
    if (state.releaseStatus === 'upcoming' && !window.from) {
      params.push(['release_date.gte', now])
    }
  }

  if (state.minRating.trim()) params.push(['vote_average.gte', state.minRating.trim()])
  if (state.minVotes.trim()) params.push(['vote_count.gte', state.minVotes.trim()])
  if (state.runtimeMin.trim()) params.push(['with_runtime.gte', state.runtimeMin.trim()])
  if (state.runtimeMax.trim()) params.push(['with_runtime.lte', state.runtimeMax.trim()])
  if (state.language.trim()) params.push(['with_original_language', state.language.trim().toLowerCase()])
  if (state.limit.trim()) params.push(['limit', state.limit.trim()])

  return params
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '))
  } catch {
    return value
  }
}

export function parseFilteringParams(query: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const pair of query.split('&')) {
    const index = pair.indexOf('=')
    if (index < 0) continue
    result[decode(pair.slice(0, index))] = decode(pair.slice(index + 1))
  }
  return result
}

/**
 * Reads a published query back into editor state. Unknown/extra params are
 * ignored (the editor only authors the facets it knows), which means saving
 * an edited row rewrites the query from these fields — intentional: the
 * portal is the only editor for portal-authored rows, and the app keeps its
 * own copy in sync through Save & Publish.
 */
export function parseFilteringState(
  query: string,
  mediaKind: FilteringMediaKind = 'movie',
): FilteringState {
  const params = parseFilteringParams(query)
  const state: FilteringState = { ...DEFAULT_FILTERING_STATE, mediaKind }

  // The date prefix is authoritative about the kind when it disagrees with
  // the row's media_type (a row published before the app wrote the right key).
  if (params['first_air_date.gte'] || params['first_air_date.lte']) state.mediaKind = 'series'
  const key = dateKey(state.mediaKind)
  const from = params[`${key}.gte`]
  const to = params[`${key}.lte`]

  const sort = params['sort_by'] ?? ''
  if (sort === 'trending.day') state.ordering = 'trendingDay'
  else if (sort === 'trending.week') state.ordering = 'trendingWeek'
  else if (sort.startsWith('vote_average')) state.ordering = 'topRated'
  else if (sort === 'revenue.desc') state.ordering = 'revenue'
  else if (sort.startsWith('primary_release_date.desc') || sort.startsWith('first_air_date.desc')) state.ordering = 'newest'
  else if (sort.startsWith('primary_release_date.asc') || sort.startsWith('first_air_date.asc')) state.ordering = 'oldest'
  else state.ordering = 'popular'

  if (params['with_genres']) {
    state.genreIds = params['with_genres']
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value > 0)
  }

  const now = todayString()
  const isUpcomingWindow = Boolean(from) && !to && from === now
  if (!from && !to) {
    state.period = 'any'
  } else if (isUpcomingWindow) {
    state.period = 'upcoming'
  } else if (from === '1900-01-01' && to === now) {
    state.period = 'toPresent'
  } else if (from === '2020-01-01' && to === '2029-12-31') {
    state.period = 'y2020s'
  } else if (from === '2010-01-01' && to === '2019-12-31') {
    state.period = 'y2010s'
  } else if (from === '2000-01-01' && to === '2009-12-31') {
    state.period = 'y2000s'
  } else if (from === '1990-01-01' && to === '1999-12-31') {
    state.period = 'y1990s'
  } else if (from === '1980-01-01' && to === '1989-12-31') {
    state.period = 'y1980s'
  } else if (from === '1900-01-01' && to === '1979-12-31') {
    state.period = 'classic'
  } else {
    state.period = 'custom'
    state.customFrom = from ?? ''
    state.customTo = to ?? ''
  }

  if (params['with_release_type']) {
    const releaseTo = params['release_date.lte']
    const releaseFrom = params['release_date.gte']
    if (releaseTo === now && releaseFrom !== now) state.releaseStatus = 'released'
    else if (releaseFrom === now && releaseTo !== now) state.releaseStatus = 'upcoming'
    else if (to === now) state.releaseStatus = 'released'
    else if (from === now) state.releaseStatus = 'upcoming'
  }

  state.minRating = params['vote_average.gte'] ?? ''
  state.minVotes = params['vote_count.gte'] ?? ''
  state.runtimeMin = params['with_runtime.gte'] ?? ''
  state.runtimeMax = params['with_runtime.lte'] ?? ''
  state.language = params['with_original_language'] ?? ''
  state.limit = params['limit'] ?? ''
  return state
}

/** Every query key this editor authors. Anything else (keywords, cast,
 *  crew, providers, region, companies, country, `vote_average.lte`, an
 *  optional `region`, …) is preserved from the row's original query when it
 *  is re-saved — the editor used to rebuild the string from its own state, so
 *  opening a widget the app had published silently deleted those filters. */
export const AUTHORED_PARAMS: ReadonlySet<string> = new Set([
  'sort_by',
  'with_genres',
  'primary_release_date.gte',
  'primary_release_date.lte',
  'first_air_date.gte',
  'first_air_date.lte',
  'with_release_type',
  'release_date.gte',
  'release_date.lte',
  'vote_average.gte',
  'vote_count.gte',
  'with_runtime.gte',
  'with_runtime.lte',
  'with_original_language',
  'limit',
])

/**
 * The query to save: the editor's own facets, plus everything it doesn't
 * touch carried over from `originalQuery` in its original order.
 */
export function mergeFilteringQuery(
  originalQuery: string,
  authoredState: FilteringState,
  today?: string,
): string {
  const authored = buildFilteringQuery(authoredState, today)
  const authoredKeys = new Set(authored.split('&').filter(Boolean).map((pair) => pair.split('=')[0]))
  const preserved: string[] = []
  for (const pair of originalQuery.split('&')) {
    if (!pair) continue
    const key = pair.split('=')[0]
    if (AUTHORED_PARAMS.has(decodeURIComponent(key)) || authoredKeys.has(key)) continue
    preserved.push(pair)
  }
  return [preserved.join('&'), authored].filter(Boolean).join('&')
}

/** Human summary for cards and the editor header — same facets the app's
 *  builder exposes, phrased for a glance. */
export function filteringSummary(query: string): string {
  const params = parseFilteringParams(query)
  const parts: string[] = []
  const sort = params['sort_by'] ?? ''
  if (sort === 'trending.day') parts.push('Trending Today')
  else if (sort === 'trending.week') parts.push('Trending This Week')
  else if (sort === 'popularity.desc') parts.push('Popular')
  else if (sort.startsWith('vote_average')) parts.push('Top Rated')
  else if (sort.startsWith('revenue')) parts.push('Revenue')
  else if (sort.endsWith('.desc')) parts.push('Newest')
  else if (sort.endsWith('.asc')) parts.push('Oldest')
  else if (sort) parts.push(sort)

  const genres = params['with_genres']
  if (genres) {
    const count = genres.split(',').filter(Boolean).length
    parts.push(`${count} genre${count === 1 ? '' : 's'}`)
  }
  if (params['with_release_type']) {
    if (params['release_date.gte'] === todayString()) parts.push('upcoming')
    else parts.push('released')
  }
  if (params['with_original_language']) parts.push(params['with_original_language'].toUpperCase())
  const from = params['primary_release_date.gte'] ?? params['first_air_date.gte']
  const to = params['primary_release_date.lte'] ?? params['first_air_date.lte']
  if (from || to) {
    const short = (value: string) => value.slice(0, 4)
    if (from && !to) parts.push(`from ${short(from)}`)
    else if (!from && to) parts.push(`to ${short(to)}`)
    else parts.push(`${short(from!)}–${short(to!)}`)
  }
  if (params['vote_average.gte']) parts.push(`${params['vote_average.gte']}+ rating`)
  if (params['vote_count.gte']) parts.push(`${params['vote_count.gte']}+ votes`)
  if (params['with_runtime.gte'] || params['with_runtime.lte']) parts.push('runtime')
  const limit = params['limit']
  if (limit) parts.push(`max ${limit}`)
  return parts.length ? parts.join(' · ') : 'TMDB filter'
}
