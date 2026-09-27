import type { Plan, UserRole } from '../types';

/**
 * The one place plan facts live. The landing page, the pricing page, the
 * signup picker and the account pages all read from here, so a price or a
 * profile limit can no longer disagree between pages.
 *
 * Prices must match the Stripe products behind `create-checkout-session`.
 */

export interface PlanFacts {
  id: 'friends_family' | Plan;
  name: string;
  /** "$9.99" for billed plans, null for invite-only. */
  price: string | null;
  who: string;
  features: string[];
  cta: string;
  to: string;
  featured?: boolean;
  /** Profiles per account. null = no limit. */
  profileLimit: number | null;
  streams: number;
}

export const PLANS: PlanFacts[] = [
  {
    id: 'friends_family',
    name: 'Friends & Family',
    price: null,
    who: 'For people invited by a Moonlit admin.',
    features: ['Shared household catalog', 'Up to 4 profiles', 'Every device', 'No billing'],
    cta: 'I have an invite code',
    to: '/signup?tab=invite',
    profileLimit: 4,
    streams: 1,
  },
  {
    id: 'spotlight',
    name: 'Spotlight',
    price: '$9.99',
    who: 'For a household that just wants to watch.',
    features: ['Full curated catalog', '2 streams at once, up to 4K HDR', 'Up to 4 profiles', 'Mac, iPhone, iPad and web'],
    cta: 'Choose Spotlight',
    to: '/signup?plan=spotlight',
    featured: true,
    profileLimit: 4,
    streams: 2,
  },
  {
    id: 'studio',
    name: 'Studio',
    price: '$14.99',
    who: 'For power users who want more control.',
    features: [
      'Everything in Spotlight',
      '4 streams at once in 4K HDR',
      'Unlimited profiles',
      'Add your own sources and catalog',
      'Priority stream warm-up and early features',
    ],
    cta: 'Choose Studio',
    to: '/signup?plan=studio',
    profileLimit: null,
    streams: 4,
  },
];

export const PLAN_BY_ID = Object.fromEntries(PLANS.map((p) => [p.id, p])) as Record<PlanFacts['id'], PlanFacts>;

/** Short labels for the signup picker and billing badge. */
export const PLAN_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  friends_family: 'Friends & Family',
  spotlight: 'Spotlight',
  studio: 'Studio',
  free: 'Free',
  restricted: 'Restricted',
};

/** Profiles an account may hold. Admins and Studio have no limit. */
export function profileLimitFor(role: UserRole | null): number | null {
  if (role === 'admin' || role === 'studio') return null;
  if (role === 'spotlight' || role === 'friends_family') return 4;
  return 1;
}

/** Rows for the comparison table on the pricing page. */
export const COMPARISON: { label: string; values: [string, string, string] }[] = [
  { label: 'Price', values: ['By invitation', '$9.99 / mo', '$14.99 / mo'] },
  { label: 'Full curated catalog', values: ['✓', '✓', '✓'] },
  { label: 'Simultaneous streams', values: ['1', '2', '4'] },
  { label: 'Maximum quality', values: ['4K HDR', '4K HDR', '4K HDR'] },
  { label: 'Profiles', values: ['Up to 4', 'Up to 4', 'Unlimited'] },
  { label: 'Mac, iPhone, iPad and web', values: ['✓', '✓', '✓'] },
  { label: 'Add your own sources and catalog', values: ['—', '—', '✓'] },
  { label: 'Priority stream warm-up', values: ['—', '—', '✓'] },
  { label: 'Early access to features', values: ['—', '—', '✓'] },
  { label: 'Billing', values: ['None', 'Monthly', 'Monthly'] },
];
