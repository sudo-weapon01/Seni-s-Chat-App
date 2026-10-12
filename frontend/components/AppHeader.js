'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { PresenceAvatar } from '@/components/Avatar';
import { useSocket } from '@/context/SocketContext';

export function AppHeader({ title, onMenu }) {
  const { user, logout } = useAuth();
  const { presence, connected } = useSocket();
  const router = useRouter();
  const pathname = usePathname();

  async function onLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <div className="sidebar-head">
      <div className="me-row">
        {onMenu ? (
          <button className="btn ghost mobile-only" type="button" onClick={onMenu}>Menu</button>
        ) : null}
        <PresenceAvatar user={user} online={connected || (user && presence[user.id])} />
        <div>
          <div className="name">{title || user?.username || 'You'}</div>
          <div className="meta">{connected ? 'Online' : 'Connecting…'}</div>
        </div>
      </div>
      <div className="nav-actions">
        <Link className={`btn secondary ${pathname?.startsWith('/chat') ? 'active' : ''}`} href="/chat">Chats</Link>
        <Link className={`btn secondary ${pathname === '/search' ? 'active' : ''}`} href="/search">Search</Link>
        <Link className={`btn secondary ${pathname === '/profile' ? 'active' : ''}`} href="/profile">Profile</Link>
        <button className="btn ghost" type="button" onClick={onLogout}>Log out</button>
      </div>
    </div>
  );
}
