'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { RequireAuth } from '@/components/RequireAuth';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';

function ProfileInner() {
  const { user, setUser } = useAuth();
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setBio(user.bio || '');
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [user]);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSaved(false);
    setBusy(true);
    try {
      const data = await api('/users/me', {
        method: 'PATCH',
        body: { bio, avatarUrl: avatarUrl.trim() || null },
      });
      setUser(data.user);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell" style={{ gridTemplateColumns: '1fr' }}>
      <section className="chat">
        <AppHeader title="Your profile" />
        <div className="panel">
          <div className="profile-hero">
            <Avatar user={{ ...user, avatarUrl: avatarUrl || user?.avatarUrl }} size="lg" />
            <div>
              <h1>{user?.username}</h1>
              <p className="muted">{user?.email}</p>
            </div>
          </div>
          {error ? <div className="error">{error}</div> : null}
          {saved ? <p className="muted">Profile saved.</p> : null}
          <form onSubmit={onSubmit}>
            <label htmlFor="avatarUrl">Avatar URL</label>
            <input
              id="avatarUrl"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/photo.jpg"
            />
            <label htmlFor="bio">Bio</label>
            <textarea id="bio" maxLength={500} value={bio} onChange={(e) => setBio(e.target.value)} />
            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save profile'}</button>
              <Link className="btn secondary" href="/chat">Back to chats</Link>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileInner />
    </RequireAuth>
  );
}
