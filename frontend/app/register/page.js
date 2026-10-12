'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function RegisterPage() {
  const { register, user, ready } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) {
      router.replace('/chat');
    }
  }, [ready, user, router]);

  if (ready && user) {
    return <div className="page-center muted">Redirecting to chat…</div>;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register({ username, email, password });
      router.push('/chat');
    } catch (err) {
      const extra = err.details?.map((d) => d.message).join(' ');
      setError(extra || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-center">
      <form className="card" onSubmit={onSubmit}>
        <div className="brand">
          <div className="brand-mark" />
          <div>
            <h1>Create account</h1>
            <p className="lede" style={{ margin: 0 }}>Start messaging in a few seconds</p>
          </div>
        </div>
        {error ? <div className="error">{error}</div> : null}
        <label htmlFor="username">Username</label>
        <input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength={3}
          maxLength={32}
          required
        />
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        <p className="muted" style={{ fontSize: '0.82rem' }}>
          Use at least 8 characters with a letter and a number.
        </p>
        <button className="btn block" disabled={busy} type="submit">
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <p className="muted" style={{ marginTop: 16, textAlign: 'center' }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
