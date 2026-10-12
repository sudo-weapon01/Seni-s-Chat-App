'use client';

import { avatarSrc } from '@/lib/format';

export function Avatar({ user, size = 'md' }) {
  const cls = size === 'lg' ? 'avatar lg' : size === 'sm' ? 'avatar sm' : 'avatar';
  return (
    <img
      className={cls}
      src={avatarSrc(user)}
      alt={user?.username || 'avatar'}
    />
  );
}

export function PresenceAvatar({ user, online }) {
  return (
    <span className="presence">
      <Avatar user={user} />
      <span className={`dot ${online ? 'on' : ''}`} />
    </span>
  );
}
