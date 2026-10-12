'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { RequireAuth } from '@/components/RequireAuth';
import { AppHeader } from '@/components/AppHeader';
import { Avatar } from '@/components/Avatar';
import { useSocket } from '@/context/SocketContext';
import { useAuth } from '@/context/AuthContext';

function UserProfileInner() {
  const params = useParams();
  const router = useRouter();
  const { user: me } = useAuth();
  const { presence } = useSocket();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!params?.id) return;
    api(`/users/${params.id}`)
      .then((data) => setProfile(data.user))
      .catch((err) => setError(err.message));
  }, [params?.id]);

  async function startChat() {
    if (!profile?.id || busy) return;
    setError('');
    setBusy(true);
    try {
      const data = await api('/conversations', { method: 'POST', body: { userId: profile.id } });
      router.push(`/chat?c=${data.conversation.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell" style={{ gridTemplateColumns: '1fr' }}>
      <section className="chat">
        <AppHeader title="Profile" />
        <div className="panel">
          {error ? <div className="error">{error}</div> : null}
          {!profile ? <p className="muted">Loading profile…</p> : (
            <>
              <div className="profile-hero">
                <Avatar user={profile} size="lg" />
                <div>
                  <h1>{profile.username}</h1>
                  <p className="muted">
                    {presence[profile.id] ? 'Online' : 'Offline'}
                    {profile.email ? ` · ${profile.email}` : ''}
                  </p>
                </div>
              </div>
              <p>{profile.bio || 'No bio yet.'}</p>
              <div className="row" style={{ marginTop: 16 }}>
                {profile.id !== me?.id ? (
                  <button className="btn" type="button" disabled={busy} onClick={startChat}>
                    {busy ? 'Opening…' : 'Message'}
                  </button>
                ) : (
                  <Link className="btn" href="/profile">Edit profile</Link>
                )}
                <Link className="btn secondary" href="/search">Back to search</Link>
                <Link className="btn ghost" href="/chat">Chats</Link>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default function UserProfilePage() {
  return (
    <RequireAuth>
      <UserProfileInner />
    </RequireAuth>
  );
}
