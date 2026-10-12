'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { RequireAuth } from '@/components/RequireAuth';
import { AppHeader } from '@/components/AppHeader';
import { PresenceAvatar } from '@/components/Avatar';
import { useSocket } from '@/context/SocketContext';

function SearchInner() {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [startingId, setStartingId] = useState(null);
  const router = useRouter();
  const { presence } = useSocket();

  async function onSearch(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api(`/users/search?q=${encodeURIComponent(q.trim())}`);
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function startChat(userId) {
    if (startingId) return;
    setError('');
    setStartingId(userId);
    try {
      const data = await api('/conversations', { method: 'POST', body: { userId } });
      router.push(`/chat?c=${data.conversation.id}`);
    } catch (err) {
      setError(err.message);
      setStartingId(null);
    }
  }

  return (
    <div className="shell" style={{ gridTemplateColumns: '1fr' }}>
      <section className="chat">
        <AppHeader title="Search people" />
        <form className="search-bar" onSubmit={onSearch}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by username or email"
            minLength={1}
            required
          />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" disabled={busy} type="submit">{busy ? 'Searching…' : 'Search'}</button>
            <Link className="btn secondary" href="/chat">Back to chats</Link>
          </div>
        </form>
        {error ? <div className="error" style={{ margin: 16 }}>{error}</div> : null}
        <div className="list">
          {users.length === 0 ? (
            <div className="empty">Search results will appear here. The database starts empty — register a second account to try this.</div>
          ) : (
            users.map((u) => (
              <div key={u.id} className="list-item">
                <PresenceAvatar user={u} online={presence[u.id]} />
                <div className="item-main">
                  <div className="name">{u.username}</div>
                  <div className="preview">{u.email}{u.bio ? ` · ${u.bio}` : ''}</div>
                </div>
                <div className="row">
                  <Link className="btn secondary" href={`/users/${u.id}`}>Profile</Link>
                  <button
                    className="btn"
                    type="button"
                    disabled={startingId === u.id}
                    onClick={() => startChat(u.id)}
                  >
                    {startingId === u.id ? 'Opening…' : 'Message'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default function SearchPage() {
  return (
    <RequireAuth>
      <SearchInner />
    </RequireAuth>
  );
}
