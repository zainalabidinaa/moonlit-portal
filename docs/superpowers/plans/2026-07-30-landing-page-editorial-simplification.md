# Landing Page Plain-Language Copy + Curator Spotlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `trymoonlit.app`'s public landing page (`src/routes/public/LandingPage.tsx`) friendlier to non-technical visitors by removing jargon ("Stremio engine", "addons") from the main pitch, adding a plain 3-step "how it works" section, and adding a "Curator spotlight" section that combines a hand-written founder note with a live "Trending now" strip of popular movies/TV pulled from TMDB.

**Architecture:** Two new presentational components (`HowItWorks.tsx`, `CuratorSpotlight.tsx`) added to `src/components/landing/`, following the existing pattern of that directory (see `CrossPlatform.tsx`, `FeatureShowcase.tsx` — plain functional components, `Reveal` for scroll-in animation, hardcoded content arrays). A new Supabase edge function `tmdb-popular` holds the TMDB API key server-side, fetches + caches TMDB's popular movies/TV, and is called from `CuratorSpotlight.tsx` via plain `fetch` (matching the existing `admin-users` call pattern in `UsersPage.tsx`), never via a client-side TMDB key.

**Tech Stack:** React + TypeScript + Vite (frontend), Tailwind (styling), Supabase Edge Functions (Deno), Vitest + Testing Library (tests).

---

## Task 1: Remove jargon from existing landing copy

**Files:**
- Modify: `src/routes/public/LandingPage.tsx:180-183` (hero subtext)
- Modify: `src/routes/public/LandingPage.tsx:56` (Premium+ pricing feature list)
- Modify: `src/components/landing/FeatureShowcase.tsx:50-53` (section intro copy)
- Modify: `src/components/landing/FeatureShowcase.tsx:92` (bullet point)

- [ ] **Step 1: Rewrite the hero subtext in `LandingPage.tsx`**

Find (around line 180-183):
```tsx
            <p className="mt-5 max-w-md text-[17px] text-muted">
              A streaming platform built on the Stremio engine — curated collections,
              gorgeous artwork, and your whole household on every device.
            </p>
```

Replace with:
```tsx
            <p className="mt-5 max-w-md text-[17px] text-muted">
              Everything hand-picked, gorgeous artwork, and your whole household
              on every device — sign up, open the app, press play.
            </p>
```

- [ ] **Step 2: Reword the Premium+ "Personal addon slots" feature**

Find (around line 56, inside the `plans` array's `Premium+` entry):
```tsx
    features: ['4 simultaneous streams in 4K HDR', 'Unlimited profiles', 'Personal addon slots', 'Priority stream warm-up', 'Early access features'],
```

Replace with:
```tsx
    features: ['4 simultaneous streams in 4K HDR', 'Unlimited profiles', 'Add your own sources — optional, for power users', 'Priority stream warm-up', 'Early access features'],
```

- [ ] **Step 3: Reword the `FeatureShowcase` section intro**

Find (around line 50-53 in `src/components/landing/FeatureShowcase.tsx`):
```tsx
        <p className="mt-4 text-[16px] text-muted">
          Moonlit wraps the Stremio engine in an interface built for the couch — cinematic, fast,
          and the same everywhere you sign in.
        </p>
```

Replace with:
```tsx
        <p className="mt-4 text-[16px] text-muted">
          An interface built for the couch — cinematic, fast, and the same
          everywhere you sign in.
        </p>
```

- [ ] **Step 4: Reword the "Every source, ranked" bullet point**

Find (around line 92 in `src/components/landing/FeatureShowcase.tsx`):
```tsx
            'Your own Stremio addons, loaded as-is',
```

Replace with:
```tsx
            'Already have your own sources? Bring them along too',
```

- [ ] **Step 5: Verify the dev server renders the changes**

Run:
```bash
npm run dev
```
Open the landing page in the browser and confirm the hero, pricing, and feature-showcase copy no longer contain the words "Stremio" or "addon" anywhere in the visible text.

- [ ] **Step 6: Commit**

```bash
git add src/routes/public/LandingPage.tsx src/components/landing/FeatureShowcase.tsx
git commit -m "copy: remove Stremio/addon jargon from landing page"
```

---

## Task 2: Add the "How it works" section

**Files:**
- Create: `src/components/landing/HowItWorks.tsx`
- Test: `src/components/landing/HowItWorks.test.tsx`
- Modify: `src/routes/public/LandingPage.tsx` (import + render)

- [ ] **Step 1: Write the failing test**

Create `src/components/landing/HowItWorks.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HowItWorks } from './HowItWorks';

describe('HowItWorks', () => {
  it('renders the three plain-language steps without addon/Stremio jargon', () => {
    render(<HowItWorks />);
    expect(screen.getByText(/sign up/i)).toBeInTheDocument();
    expect(screen.getByText(/open the app/i)).toBeInTheDocument();
    expect(screen.getByText(/press play/i)).toBeInTheDocument();
    expect(screen.queryByText(/stremio/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/addon/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/landing/HowItWorks.test.tsx`
Expected: FAIL — `Failed to resolve import "./HowItWorks"` (module doesn't exist yet).

- [ ] **Step 3: Create the component**

Create `src/components/landing/HowItWorks.tsx`:
```tsx
import { Reveal } from './Reveal';

const steps = [
  {
    n: '01',
    title: 'Sign up',
    body: 'Pick a plan, or use an invite code if someone already has Moonlit.',
  },
  {
    n: '02',
    title: 'Open the app',
    body: 'iOS, Mac, or right here in the browser — everything is already set up for you.',
  },
  {
    n: '03',
    title: 'Press play',
    body: 'Browse the curated collections and start watching. No configuration required.',
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-24">
      <Reveal className="mx-auto mb-16 max-w-2xl text-center">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.28em] text-accent">
          Getting started
        </p>
        <h2 className="font-display text-[clamp(32px,5vw,60px)] font-extrabold uppercase">
          Three steps, that's it
        </h2>
      </Reveal>

      <div className="grid gap-8 md:grid-cols-3">
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 90}>
            <div className="rounded-2xl border border-border bg-surface p-7 text-center">
              <div
                className="font-display text-4xl font-extrabold text-accent"
                style={{ textShadow: '0 0 30px var(--accent-glow)' }}
              >
                {s.n}
              </div>
              <h3 className="mt-3 font-display text-xl font-extrabold uppercase">{s.title}</h3>
              <p className="mt-2 text-sm text-muted">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/landing/HowItWorks.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Render it on the landing page**

In `src/routes/public/LandingPage.tsx`, add the import near the other landing component imports:
```tsx
import { HowItWorks } from '../../components/landing/HowItWorks';
```

Then place it right after the hero's `<Marquee ... />` and before `<FeatureShowcase />`:
```tsx
      <Marquee items={['Streaming', 'Collections', '4K HDR', 'Multi-profile', 'No ads', 'Cross-device']} />

      {/* HOW IT WORKS */}
      <HowItWorks />

      {/* FEATURE SHOWCASE */}
      <FeatureShowcase />
```

- [ ] **Step 6: Verify in the browser**

Run `npm run dev`, open the landing page, confirm the new "Three steps, that's it" section appears between the top marquee and the feature showcase.

- [ ] **Step 7: Commit**

```bash
git add src/components/landing/HowItWorks.tsx src/components/landing/HowItWorks.test.tsx src/routes/public/LandingPage.tsx
git commit -m "feat: add plain-language 'how it works' section to landing page"
```

---

## Task 3: TMDB popular edge function

**Files:**
- Create: `supabase/functions/tmdb-popular/index.ts`

- [ ] **Step 1: Create the edge function**

Create `supabase/functions/tmdb-popular/index.ts`:
```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TmdbItem {
  id: number;
  title: string;
  poster_path: string | null;
  media_type: 'movie' | 'tv';
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let cache: { items: TmdbItem[]; fetchedAt: number } | null = null;

async function fetchTmdbPopular(apiKey: string): Promise<TmdbItem[]> {
  const [movieRes, tvRes] = await Promise.all([
    fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=en-US&page=1`),
    fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${apiKey}&language=en-US&page=1`),
  ]);

  if (!movieRes.ok || !tvRes.ok) {
    throw new Error(`TMDB request failed: movie=${movieRes.status} tv=${tvRes.status}`);
  }

  const movieJson = await movieRes.json();
  const tvJson = await tvRes.json();

  const movies: TmdbItem[] = (movieJson.results ?? []).slice(0, 5).map((m: any) => ({
    id: m.id,
    title: m.title,
    poster_path: m.poster_path ?? null,
    media_type: 'movie' as const,
  }));

  const shows: TmdbItem[] = (tvJson.results ?? []).slice(0, 5).map((t: any) => ({
    id: t.id,
    title: t.name,
    poster_path: t.poster_path ?? null,
    media_type: 'tv' as const,
  }));

  // Interleave movies and shows so the strip isn't all-movies-then-all-tv.
  const merged: TmdbItem[] = [];
  for (let i = 0; i < Math.max(movies.length, shows.length); i++) {
    if (movies[i]) merged.push(movies[i]);
    if (shows[i]) merged.push(shows[i]);
  }
  return merged;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const now = Date.now();
    if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
      return new Response(JSON.stringify(cache.items), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
      });
    }

    const apiKey = Deno.env.get('TMDB_API_KEY');
    if (!apiKey) {
      throw new Error('TMDB_API_KEY is not configured');
    }

    const items = await fetchTmdbPopular(apiKey);
    cache = { items, fetchedAt: now };

    return new Response(JSON.stringify(items), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    console.error('tmdb-popular error:', err);
    // Fail silent for the caller (empty list) — this backs a public marketing page,
    // not a critical path. The error is logged above for debugging.
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

- [ ] **Step 2: Deploy the function**

Run:
```bash
supabase functions deploy tmdb-popular
```
Expected: deploy succeeds (function will return `[]` until the secret below is set — that's expected and handled gracefully by the frontend in Task 4).

- [ ] **Step 3: Set the TMDB API key secret (you provide the value, not Claude)**

Run, substituting your real TMDB v3 API key:
```bash
supabase secrets set TMDB_API_KEY=your_real_key_here
```

- [ ] **Step 4: Verify the function manually**

Run:
```bash
curl -s "$VITE_SUPABASE_FUNCTIONS_URL/tmdb-popular" | head -c 500
```
Expected: a JSON array of up to 10 objects shaped like `{"id":..., "title":"...", "poster_path":"...", "media_type":"movie"}`.

Run the same curl command again immediately after.
Expected: identical response returned near-instantly (served from the in-memory cache, no duplicate TMDB calls — check the Supabase function logs to confirm only one "fetch" happened).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/tmdb-popular/index.ts
git commit -m "feat: add tmdb-popular edge function with 1hr in-memory cache"
```

---

## Task 4: Curator spotlight section (founder note + trending strip)

**Files:**
- Create: `src/components/landing/CuratorSpotlight.tsx`
- Test: `src/components/landing/CuratorSpotlight.test.tsx`
- Modify: `src/routes/public/LandingPage.tsx` (import + render)

- [ ] **Step 1: Write the failing tests**

Create `src/components/landing/CuratorSpotlight.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CuratorSpotlight } from './CuratorSpotlight';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CuratorSpotlight', () => {
  it('always renders the founder note', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    render(<CuratorSpotlight />);
    expect(screen.getByText(/why (i|we) built moonlit/i)).toBeInTheDocument();
  });

  it('renders trending titles once the TMDB fetch resolves', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 1, title: 'Test Movie', poster_path: '/abc.jpg', media_type: 'movie' },
        ],
      })
    );
    render(<CuratorSpotlight />);
    await waitFor(() => expect(screen.getByText('Test Movie')).toBeInTheDocument());
    expect(screen.getByText(/trending now/i)).toBeInTheDocument();
  });

  it('renders no trending strip (but still the founder note) if the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    render(<CuratorSpotlight />);
    await waitFor(() => expect(screen.getByText(/why (i|we) built moonlit/i)).toBeInTheDocument());
    expect(screen.queryByText(/trending now/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/landing/CuratorSpotlight.test.tsx`
Expected: FAIL — `Failed to resolve import "./CuratorSpotlight"` (module doesn't exist yet).

- [ ] **Step 3: Create the component**

Create `src/components/landing/CuratorSpotlight.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Reveal } from './Reveal';

interface TrendingItem {
  id: number;
  title: string;
  poster_path: string | null;
  media_type: 'movie' | 'tv';
}

function useTrendingNow() {
  const [items, setItems] = useState<TrendingItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/tmdb-popular`)
      .then(async (r) => {
        if (!r.ok) return [];
        return (await r.json()) as TrendingItem[];
      })
      .then((data) => {
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return items;
}

export function CuratorSpotlight() {
  const trending = useTrendingNow();

  return (
    <section className="mx-auto max-w-7xl px-5 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.28em] text-accent">
          From the team
        </p>
        <h2 className="font-display text-[clamp(32px,5vw,60px)] font-extrabold uppercase">
          Why we built Moonlit
        </h2>
        <p className="mt-4 text-[16px] text-muted">
          We got tired of juggling five apps just to find something to watch with
          the people we live with. Every collection here is picked by hand, on
          purpose — no clutter, no dead ends, just press play.
        </p>
      </Reveal>

      {trending.length > 0 && (
        <div className="mt-16">
          <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.28em] text-faint">
            Trending now
          </p>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {trending.map((item) => (
              <div key={`${item.media_type}-${item.id}`} className="w-32 flex-none">
                <div className="aspect-[2/3] overflow-hidden rounded-lg border border-border bg-bg2">
                  {item.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="font-mono text-[9px] text-faint">no image</span>
                    </div>
                  )}
                </div>
                <p className="mt-1.5 truncate text-xs text-muted">{item.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/landing/CuratorSpotlight.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Render it on the landing page**

In `src/routes/public/LandingPage.tsx`, add the import:
```tsx
import { CuratorSpotlight } from '../../components/landing/CuratorSpotlight';
```

Place it directly before `<CollectionsPreviewSection />`:
```tsx
      {/* CURATOR SPOTLIGHT */}
      <CuratorSpotlight />

      {/* COLLECTIONS PREVIEW */}
      <CollectionsPreviewSection />
```

- [ ] **Step 6: Verify in the browser**

Run `npm run dev` (make sure `VITE_SUPABASE_FUNCTIONS_URL` is set in your local `.env`), open the landing page, confirm:
- The "Why we built Moonlit" founder note always renders.
- If `TMDB_API_KEY` is set on the deployed function, the "Trending now" strip renders real posters/titles below it.
- If the TMDB secret isn't set yet, the founder note still renders and the trending strip is simply absent (no error shown).

- [ ] **Step 7: Commit**

```bash
git add src/components/landing/CuratorSpotlight.tsx src/components/landing/CuratorSpotlight.test.tsx src/routes/public/LandingPage.tsx
git commit -m "feat: add curator spotlight section (founder note + TMDB trending strip)"
```

---

## Task 5: Full landing page regression check

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run:
```bash
npm test
```
Expected: all tests pass, including the new `HowItWorks.test.tsx` and `CuratorSpotlight.test.tsx`.

- [ ] **Step 2: Run the production build**

Run:
```bash
npm run build
```
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Manual browser walkthrough**

With `npm run dev` running, open the landing page and confirm top-to-bottom order is: Hero → Marquee → How It Works → Feature Showcase → Curator Spotlight → Collections Preview → Cross-Platform → Stats → Pricing → Footer. Confirm no visible text anywhere on the page contains "Stremio" or "addon" except the optional Premium+ footnote about adding your own sources.

- [ ] **Step 4: Final commit (if any cleanup was needed)**

```bash
git add -A
git commit -m "chore: landing page regression pass"
```
(Skip this step if there was nothing left to fix.)
