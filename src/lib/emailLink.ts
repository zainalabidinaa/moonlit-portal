import type { EmailOtpType } from '@supabase/supabase-js';
import { supabase } from './supabase';

const TYPES: EmailOtpType[] = ['email', 'magiclink', 'signup', 'invite', 'recovery', 'email_change'];

export interface EmailLink {
  tokenHash: string;
  type: EmailOtpType;
}

/** Reads a sign-in link that points at our own domain
 *  (`/auth/confirm?token_hash=…&type=email`) instead of Supabase's. */
export function readEmailLink(search: string): EmailLink | null {
  const params = new URLSearchParams(search);
  const tokenHash = params.get('token_hash');
  const type = params.get('type') as EmailOtpType | null;
  if (!tokenHash || !type || !TYPES.includes(type)) return null;
  return { tokenHash, type };
}

/** Finishes an email sign-in on this page, then removes the one-time token
 *  from the address bar so it isn't left in history or shared by accident. */
export async function completeEmailLink(cleanPath: string): Promise<'none' | 'signed-in' | 'failed'> {
  const link = readEmailLink(window.location.search);
  if (!link) return 'none';
  const { error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type });
  window.history.replaceState(null, '', cleanPath);
  return error ? 'failed' : 'signed-in';
}
