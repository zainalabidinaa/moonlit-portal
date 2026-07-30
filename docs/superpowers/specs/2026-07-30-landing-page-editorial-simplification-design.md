# Landing page: plain-language copy + editorial/curated feel

Date: 2026-07-30

## Problem

`src/routes/public/LandingPage.tsx` (the public `trymoonlit.app` marketing page) has two issues:

1. **Jargon assumes technical familiarity.** The hero copy says "built on the Stremio engine" and the Premium+ pricing tier says "Personal addon slots" — both meaningless to a visitor who doesn't already know what Stremio or an addon is. The page also never plainly states the "sign up → open app → press play" flow, so a first-time visitor has no reassurance that using Moonlit is simple.
2. **Nothing on the page signals a real person curates the catalog.** The existing `CollectionsPreviewSection` shows live collections/folders from Supabase, but it reads as a database dump, not editorial content picked by a person.

## Goals

- Rewrite hero and pricing copy to remove jargon and plainly state the 3-step flow (sign up, open app, press play), without ever using the words "addon"/"Stremio"/"source" in the main pitch.
- Add a "How it works" section spelling out that 3-step flow.
- Add a "Curator spotlight" section combining a hand-written founder/team note (trust, human voice) with an honestly-labeled "Trending now" strip of popular movies/TV pulled live from TMDB.
- Do this without overstating what's automatic: Premium+ users can optionally add their own sources, and that's mentioned only as an optional footnote on the Premium+ pricing card — never in the main hero/how-it-works copy.

## Non-goals

- Not building an admin UI to manage the founder note or curated picks — the founder note is a hardcoded string in the component; the "Trending now" list is always TMDB-driven (no manual override in this pass).
- Not touching the in-app Home screen / `home-organizer` edge function / per-user home personalization — that's a separate, larger effort covered in the earlier conversation (per-user layout overrides) and is out of scope here.
- Not building a general TMDB integration layer for other parts of the app — this is scoped to one edge function for the landing page's "trending now" strip.

## Design

### 1. Copy changes (in `LandingPage.tsx`, no new files)

- Hero subtext: replace "A streaming platform built on the Stremio engine — curated collections, gorgeous artwork, and your whole household on every device." with plain-language copy emphasizing hand-picked content, no technical plumbing mentioned.
- Premium+ pricing feature "Personal addon slots" → reworded as an optional, power-user footnote, e.g. "Add your own sources — optional, for power users."
- Existing chips (`4K • HDR`, `Multi-profile`, `Curated collections`, `iOS · Mac · Web`) stay as-is — not jargon.

### 2. `HowItWorks` component — `src/components/landing/HowItWorks.tsx`

- New section, placed after the hero + `Marquee`, before `FeatureShowcase`.
- Three numbered steps, plain language, no mention of addons/sources:
  1. Sign up — pick a plan or use an invite code
  2. Open the app — iOS, Mac, or web, everything's already set up
  3. Press play — browse curated collections, no configuration needed
- Static content (no data fetching).

### 3. `CuratorSpotlight` component — `src/components/landing/CuratorSpotlight.tsx`

Two sub-blocks in one section, placed near `CollectionsPreviewSection`:

- **Founder/team note**: hardcoded short paragraph + name, human voice, explains why Moonlit exists. Same pattern as the existing hardcoded `stats`/`plans` arrays in `LandingPage.tsx` — lives as a constant in the component, edited via code + redeploy.
- **"Trending now" strip**: fetched from the new `tmdb-popular` edge function on mount (same effect-on-mount pattern as `useCollectionPreviews` in `LandingPage.tsx`). Renders ~8-10 poster cards (title + poster only) in a horizontal-scroll row. Labeled honestly as "Trending now" / "What everyone's watching" — explicitly NOT described as curated by the team, since it's TMDB's popularity ranking, not a human pick. Founder note and trending strip are visually distinct sub-blocks so the "human picked this" claim isn't diluted by the algorithmic list sitting right next to it.

### 4. New edge function — `supabase/functions/tmdb-popular/index.ts`

- Reads `TMDB_API_KEY` from a Supabase secret (user already has a TMDB v3 API key; needs to be set via `supabase secrets set TMDB_API_KEY=...`).
- Fetches TMDB `/movie/popular` and `/tv/popular`, merges into one list, returns simplified JSON: `{ id, title, poster_path, media_type }[]`, trimmed to ~10 items.
- Caches the result in-memory for a short TTL (e.g. 1 hour) since TMDB's "popular" list changes slowly — avoids hitting TMDB (and any rate limit) on every landing-page pageview.
- Public/unauthenticated (this is a public marketing page), open CORS.
- No database writes, no interaction with existing tables (`collections`, `folders`, `folder_sources` are untouched).

### 5. Frontend fetch in `CuratorSpotlight.tsx`

- On mount, `fetch()`/`supabase.functions.invoke('tmdb-popular')` to get the trending list.
- Render posters via TMDB's image CDN: `https://image.tmdb.org/t/p/w342/{poster_path}`.
- If the fetch fails or returns empty (e.g. TMDB down, rate-limited), the strip renders nothing (matches the existing `CollectionsPreviewSection` pattern of `if (collections.length === 0) return null;` — fail silently rather than showing a broken/error state on a public marketing page).

## Data flow

```
Landing page load
  → HowItWorks (static, no fetch)
  → CuratorSpotlight
      → founder note (static)
      → trending strip → supabase.functions.invoke('tmdb-popular')
            → edge function checks in-memory cache
                → cache hit: return cached list
                → cache miss: fetch TMDB /movie/popular + /tv/popular → cache → return
  → CollectionsPreviewSection (existing, unchanged — live Supabase collections/folders)
```

## Error handling

- TMDB fetch failure (network error, TMDB downtime, bad API key): edge function returns an empty array or a 5xx; frontend treats any non-200 or empty response as "render nothing" for the trending strip — no error banner on the public page.
- Edge function itself should log the failure (via existing Supabase function logging) so it's debuggable, but never surface an error to the visitor.

## Testing

- Manual verification in the browser preview: load the landing page, confirm hero/pricing copy no longer mentions "Stremio"/"addon" in the main pitch, confirm `HowItWorks` renders the 3 steps, confirm `CuratorSpotlight` renders the founder note and (once `TMDB_API_KEY` is set) the trending strip.
- Manually invoke the `tmdb-popular` edge function directly (curl/`supabase functions serve`) to confirm it returns the expected shape and that a second call within the TTL window is served from cache (no duplicate TMDB request in logs).
- No existing automated test suite covers landing-page components today (confirmed during exploration — this page has no test file); this spec does not introduce one, consistent with the rest of the marketing site.

## Open items for implementation

- User needs to provide the TMDB API key to set as the `TMDB_API_KEY` Supabase secret before the trending strip will work end-to-end (it can be built and merged with the strip failing-silent/empty until the secret is set).
