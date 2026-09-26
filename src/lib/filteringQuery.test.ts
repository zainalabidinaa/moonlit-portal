import { describe, expect, it } from 'vitest'
import {
  applyQuickPreset,
  buildFilteringQuery,
  DEFAULT_FILTERING_STATE,
  filteringSummary,
  filteringValidationMessage,
  mergeFilteringQuery,
  orderingSeedsVoteCount,
  parseFilteringState,
  SEEDED_VOTE_FLOOR,
  type FilteringState,
} from './filteringQuery'

const TODAY = '2026-09-22'

function state(patch: Partial<FilteringState> = {}): FilteringState {
  return { ...DEFAULT_FILTERING_STATE, ...patch }
}

describe('buildFilteringQuery', () => {
  it('defaults to popular', () => {
    expect(buildFilteringQuery(state(), TODAY)).toBe('sort_by=popularity.desc')
  })

  it('writes the trending sentinels the app routes to /trending', () => {
    expect(buildFilteringQuery(state({ ordering: 'trendingWeek' }), TODAY)).toBe('sort_by=trending.week')
    expect(buildFilteringQuery(state({ ordering: 'trendingDay' }), TODAY)).toBe('sort_by=trending.day')
  })

  it('uses first_air_date keys for series', () => {
    const query = buildFilteringQuery(state({ mediaKind: 'series', period: 'toPresent' }), TODAY)
    expect(query).toContain('first_air_date.gte=1900-01-01')
    expect(query).toContain(`first_air_date.lte=${TODAY}`)
  })

  it('an upcoming window has no upper bound — the app reads that as intent', () => {
    const query = buildFilteringQuery(state({ period: 'upcoming' }), TODAY)
    expect(query).toContain(`primary_release_date.gte=${TODAY}`)
    expect(query).not.toContain('.lte')
  })

  it('pairs with_release_type with a release_date window (not primary_release_date)', () => {
    // TMDB ignores `with_release_type` unless it rides a `release_date.*`
    // window; pairing it with `primary_release_date.*` made it a no-op.
    const released = buildFilteringQuery(state({ releaseStatus: 'released' }), TODAY)
    expect(released).toContain('with_release_type=2%7C3%7C4')
    expect(released).toContain(`release_date.lte=${TODAY}`)
    expect(released).not.toContain('primary_release_date.lte')

    const upcoming = buildFilteringQuery(state({ releaseStatus: 'upcoming', period: 'upcoming' }), TODAY)
    expect(upcoming).toContain(`release_date.gte=${TODAY}`)
    expect(upcoming.match(/primary_release_date.gte/g)?.length).toBe(1)
    expect(upcoming.match(/release_date.gte/g)?.length).toBe(1)
  })

  it('routes the curated list sentinels the app resolves', () => {
    expect(buildFilteringQuery(state({ ordering: 'nowPlaying' }), TODAY)).toContain('sort_by=tmdb.now_playing')
    expect(buildFilteringQuery(state({ mediaKind: 'series', ordering: 'onTheAir' }), TODAY)).toContain('sort_by=tmdb.on_the_air')
    expect(buildFilteringQuery(state({ mediaKind: 'series', ordering: 'airingToday' }), TODAY)).toContain('sort_by=tmdb.airing_today')
  })

  it('writes the TV status and next air-date window only for series', () => {
    const series = buildFilteringQuery(
      state({ mediaKind: 'series', status: '0', airDateFrom: TODAY, airDateTo: '2026-09-29' }),
      TODAY,
    )
    expect(series).toContain('with_status=0')
    expect(series).toContain(`air_date.gte=${TODAY}`)
    expect(series).toContain('air_date.lte=2026-09-29')

    const movie = buildFilteringQuery(state({ status: '0', airDateFrom: TODAY }), TODAY)
    expect(movie).not.toContain('with_status')
    expect(movie).not.toContain('air_date')
  })

  it('quick presets compose the facets they describe', () => {
    const newSeries = applyQuickPreset(state({}), 'newSeries', TODAY)
    expect(newSeries.mediaKind).toBe('series')
    expect(newSeries.ordering).toBe('newest')
    expect(newSeries.period).toBe('custom')
    expect(newSeries.customFrom).toBe('2026-07-24')
    expect(newSeries.customTo).toBe(TODAY)
    expect(newSeries.minVotes).toBe('20')

    const returning = applyQuickPreset(state({}), 'returningThisWeek', TODAY)
    expect(returning.status).toBe('0')
    expect(returning.airDateFrom).toBe(TODAY)
    expect(returning.airDateTo).toBe('2026-09-29')
  })

  it('seeds a vote floor only for the orderings that need one', () => {
    expect(orderingSeedsVoteCount('topRated')).toBe(SEEDED_VOTE_FLOOR)
    expect(orderingSeedsVoteCount('newest')).toBe(SEEDED_VOTE_FLOOR)
    expect(orderingSeedsVoteCount('oldest')).toBe(SEEDED_VOTE_FLOOR)
    expect(orderingSeedsVoteCount('popular')).toBeNull()
    expect(orderingSeedsVoteCount('trendingWeek')).toBeNull()
  })

  it('flags an impossible period/status pair', () => {
    expect(filteringValidationMessage(state({ period: 'upcoming', releaseStatus: 'released' }))).not.toBeNull()
    expect(filteringValidationMessage(state({ period: 'upcoming', releaseStatus: 'upcoming' }))).toBeNull()
  })

  it('percent-encodes values the way the app decodes them', () => {
    const query = buildFilteringQuery(state({
      genreIds: [28, 53],
      minRating: '7.5',
      minVotes: '100',
      limit: '40',
      language: 'EN',
    }), TODAY)
    expect(query).toContain('with_genres=28%2C53')
    expect(query).toContain('vote_average.gte=7.5')
    expect(query).toContain('vote_count.gte=100')
    expect(query).toContain('limit=40')
    expect(query).toContain('with_original_language=en')
    expect(query).not.toContain('+')
  })
})

describe('mergeFilteringQuery', () => {
  it('keeps the facets this editor does not author', () => {
    const original =
      'sort_by=popularity.desc&with_keywords=123&with_cast=42&with_watch_providers=8&watch_region=US&vote_average.lte=9&with_companies=420'
    const merged = mergeFilteringQuery(original, state({ ordering: 'topRated', minVotes: '250' }), TODAY)
    expect(merged).toContain('with_keywords=123')
    expect(merged).toContain('with_cast=42')
    expect(merged).toContain('with_watch_providers=8')
    expect(merged).toContain('watch_region=US')
    expect(merged).toContain('vote_average.lte=9')
    expect(merged).toContain('with_companies=420')
    // …and replaces the ones it does.
    expect(merged).toContain('sort_by=vote_average.desc')
    expect(merged).toContain('vote_count.gte=250')
    expect(merged.match(/sort_by=/g)?.length).toBe(1)
  })

  it('drops a stale window the editor is replacing', () => {
    const original = 'sort_by=popularity.desc&primary_release_date.lte=2019-12-31&with_keywords=7'
    const merged = mergeFilteringQuery(original, state({ period: 'y2020s' }), TODAY)
    expect(merged).not.toContain('2019-12-31')
    expect(merged).toContain('primary_release_date.lte=2029-12-31')
    expect(merged).toContain('with_keywords=7')
  })
})

describe('parseFilteringState', () => {
  it('round-trips status, air-date window and the curated sentinels', () => {
    const original = state({
      mediaKind: 'series',
      ordering: 'airingToday',
      status: '0',
      airDateFrom: TODAY,
      airDateTo: '2026-09-29',
    })
    expect(parseFilteringState(buildFilteringQuery(original, TODAY))).toEqual(original)
  })

  it('round-trips the release status through its release_date window', () => {
    const released = parseFilteringState(buildFilteringQuery(state({ releaseStatus: 'released' }), TODAY))
    expect(released.releaseStatus).toBe('released')

    const upcoming = parseFilteringState(
      buildFilteringQuery(state({ releaseStatus: 'upcoming', period: 'upcoming' }), TODAY),
    )
    expect(upcoming.releaseStatus).toBe('upcoming')
  })

  it('round-trips every facet it authors', () => {
    const original = state({
      mediaKind: 'series',
      ordering: 'trendingWeek',
      genreIds: [18, 9648],
      period: 'custom',
      customFrom: '2015-01-01',
      customTo: '2018-12-31',
      minRating: '8',
      minVotes: '250',
      runtimeMin: '30',
      runtimeMax: '90',
      language: 'ko',
      limit: '60',
    })
    const parsed = parseFilteringState(buildFilteringQuery(original, TODAY))
    expect(parsed).toEqual(original)
  })

  it('recognises the presets it writes', () => {
    expect(parseFilteringState(buildFilteringQuery(state({ period: 'toPresent' }), TODAY)).period).toBe('toPresent')
    expect(parseFilteringState(buildFilteringQuery(state({ period: 'upcoming' }), TODAY)).period).toBe('upcoming')
    expect(parseFilteringState(buildFilteringQuery(state({ period: 'y1990s' }), TODAY)).period).toBe('y1990s')
  })

  it('infers the media kind from a legacy first_air_date key', () => {
    const parsed = parseFilteringState('sort_by=popularity.desc&first_air_date.gte=1900-01-01', 'movie')
    expect(parsed.mediaKind).toBe('series')
  })
})

describe('filteringSummary', () => {
  it('describes a portal-authored query', () => {
    const query = buildFilteringQuery(state({
      ordering: 'trendingDay',
      genreIds: [18],
      period: 'y2020s',
      minRating: '7',
    }), TODAY)
    expect(filteringSummary(query)).toBe('Trending Today · 1 genre · 2020–2029 · 7+ rating')
  })
})
