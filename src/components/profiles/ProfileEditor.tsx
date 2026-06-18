import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { Profile } from '../../types';

const COLORS = ['#6d28d9', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4'];

// Must stay in sync with iOS/Mac moonlitAvatarURLs — avatar_id is a portable index
const AVATAR_URLS: string[] = [
  'https://media1.tenor.com/m/BbkxgHGg-EEAAAAC/butcher-billy-butcher.gif',
  'https://i.pinimg.com/originals/29/bd/26/29bd261d201e956588ee777d37d26800.gif',
  'https://i.postimg.cc/cLnhTxnr/Rick-Grimes-v2.png',
  'https://media1.giphy.com/media/v1.Y2lkPTZjMDliOTUycDg5cGFzNm1ydWo2aGZ2Njl4NnZiOHpvdjdsbHdzaTBmcTk2bGZnYyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/1qErVv5GVUac8uqBJU/giphy.gif',
  'https://media1.tenor.com/m/ZNyte-qzI8QAAAAC/spider-man-drink.gif',
  'https://hvfsntdyowapjxobtyli.supabase.co/storage/v1/object/public/avatars/Walter_White2.webp',
  'https://hvfsntdyowapjxobtyli.supabase.co/storage/v1/object/public/avatars/dexter-morgan.gif',
  'https://hvfsntdyowapjxobtyli.supabase.co/storage/v1/object/public/avatars/doakes-dexter.gif',
  'https://hvfsntdyowapjxobtyli.supabase.co/storage/v1/object/public/avatars/joker.jpeg',
  'https://hvfsntdyowapjxobtyli.supabase.co/storage/v1/object/public/avatars/360_dark_knight_0708.jpg',
  'https://hvfsntdyowapjxobtyli.supabase.co/storage/v1/object/public/avatars/butcher.gif',
  'https://hvfsntdyowapjxobtyli.supabase.co/storage/v1/object/public/avatars/Spider_Man.gif',
  'https://hvfsntdyowapjxobtyli.supabase.co/storage/v1/object/public/avatars/Spider-man_Avatar.gif',
  'https://hvfsntdyowapjxobtyli.supabase.co/storage/v1/object/public/avatars/i-am-groot.webp',
  'https://hvfsntdyowapjxobtyli.supabase.co/storage/v1/object/public/avatars/grogu-star-wars-profile-avatar.png',
  'https://hvfsntdyowapjxobtyli.supabase.co/storage/v1/object/public/avatars/mando-star-wars-profile-avatar.png',
  'https://hvfsntdyowapjxobtyli.supabase.co/storage/v1/object/public/avatars/rick_and_morty.gif',
  'https://hvfsntdyowapjxobtyli.supabase.co/storage/v1/object/public/avatars/Leo.gif',
  'https://hvfsntdyowapjxobtyli.supabase.co/storage/v1/object/public/avatars/Profile.gif',
  'https://hvfsntdyowapjxobtyli.supabase.co/storage/v1/object/public/avatars/Scott_No.gif',
  'https://hvfsntdyowapjxobtyli.supabase.co/storage/v1/object/public/avatars/B6SyssSlTgPXq.webp',
  'https://hvfsntdyowapjxobtyli.supabase.co/storage/v1/object/public/avatars/375473.jpeg',
];

const AVATAR_CATEGORIES = [
  { name: 'Breaking Bad',     emoji: '⚗️',  indices: [5] },
  { name: 'Dexter',           emoji: '🔪',  indices: [6, 7] },
  { name: 'The Boys',         emoji: '💥',  indices: [0, 10] },
  { name: 'Marvel',           emoji: '🕷️', indices: [3, 4, 11, 12, 13] },
  { name: 'DC Universe',      emoji: '🦇',  indices: [8, 9] },
  { name: 'Star Wars',        emoji: '⚔️',  indices: [14, 15] },
  { name: 'The Walking Dead', emoji: '🧟',  indices: [2] },
  { name: 'Animated',         emoji: '🎭',  indices: [16] },
  { name: 'Fan Favorites',    emoji: '⭐️', indices: [1, 17, 18, 19, 20, 21] },
];

interface ProfileEditorProps {
  profile: Profile | null;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  nextIndex: number;
}

export function ProfileEditor({ profile, onClose, onSaved, userId, nextIndex }: ProfileEditorProps) {
  const [name, setName] = useState(profile?.name ?? '');
  const [color, setColor] = useState(profile?.avatar_color ?? COLORS[0]);
  const [avatarId, setAvatarId] = useState<number | null>(profile?.avatar_id ?? null);
  const [activeCategory, setActiveCategory] = useState(0);
  const [pinEnabled, setPinEnabled] = useState(profile?.pin_enabled ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return; }
    setLoading(true);
    if (profile) {
      await supabase.from('profiles').update({
        name: name.trim(),
        avatar_color: color,
        avatar_id: avatarId,
        pin_enabled: pinEnabled,
      }).eq('id', profile.id);
    } else {
      await supabase.from('profiles').insert({
        user_id: userId,
        name: name.trim(),
        avatar_color: color,
        avatar_id: avatarId,
        pin_enabled: pinEnabled,
        profile_index: nextIndex,
        uses_primary_addons: false,
        role: 'user',
      });
    }
    setLoading(false);
    onSaved();
  }

  async function handleDelete() {
    if (!profile) return;
    if (!confirm(`Delete profile "${profile.name}"? This cannot be undone.`)) return;
    await supabase.from('profiles').delete().eq('id', profile.id);
    onSaved();
  }

  const category = AVATAR_CATEGORIES[activeCategory];

  return (
    <Modal open onClose={onClose} title={profile ? 'Edit Profile' : 'New Profile'}>
      <div className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
        {/* Avatar preview */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-white/10">
            {avatarId !== null && avatarId >= 0 && avatarId < AVATAR_URLS.length ? (
              <img
                src={AVATAR_URLS[avatarId]}
                alt="avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-2xl font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {name.trim().charAt(0).toUpperCase() || '?'}
              </div>
            )}
          </div>
        </div>

        <Input id="pname" label="Name" value={name} onChange={e => setName(e.target.value)} error={error} />

        {/* Avatar picker */}
        <div>
          <p className="text-sm font-medium text-text mb-3">Profile Picture</p>

          {/* Category tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {AVATAR_CATEGORIES.map((cat, i) => (
              <button
                key={i}
                onClick={() => setActiveCategory(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  i === activeCategory
                    ? 'bg-accent text-white'
                    : 'bg-white/5 text-text/60 hover:bg-white/10'
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Avatar grid */}
          <div className="grid grid-cols-4 gap-3 mt-3">
            {category.indices.map(idx => (
              <button
                key={idx}
                onClick={() => setAvatarId(idx)}
                className={`relative aspect-square rounded-xl overflow-hidden transition-all ${
                  avatarId === idx
                    ? 'ring-2 ring-accent ring-offset-1 ring-offset-transparent'
                    : 'ring-1 ring-white/10 hover:ring-white/30'
                }`}
              >
                <img
                  src={AVATAR_URLS[idx]}
                  alt={`avatar ${idx}`}
                  className="w-full h-full object-cover"
                />
                {avatarId === idx && (
                  <div className="absolute top-1 right-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}

            {/* Clear avatar option */}
            <button
              onClick={() => setAvatarId(null)}
              className={`relative aspect-square rounded-xl overflow-hidden transition-all flex items-center justify-center ${
                avatarId === null
                  ? 'ring-2 ring-accent ring-offset-1 ring-offset-transparent bg-white/10'
                  : 'ring-1 ring-white/10 hover:ring-white/30 bg-white/5'
              }`}
            >
              <span className="text-xs text-text/50 text-center leading-tight px-1">No<br/>Picture</span>
            </button>
          </div>
        </div>

        {/* Color picker (fallback color when no avatar) */}
        <div>
          <p className="text-sm font-medium text-text mb-2">Profile Color</p>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-accent' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={pinEnabled} onChange={e => setPinEnabled(e.target.checked)} className="w-4 h-4 accent-accent" />
          <span className="text-sm text-text">Require PIN to access</span>
        </label>

        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} loading={loading} className="flex-1">Save</Button>
          {profile && <Button variant="danger" onClick={handleDelete}>Delete</Button>}
        </div>
      </div>
    </Modal>
  );
}
