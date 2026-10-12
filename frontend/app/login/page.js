'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { login, user, ready } = useAuth();
  const router = useRouter();
  const [loginValue, setLoginValue] = useState('');
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
      await login(loginValue, password);
      router.push('/chat');
    } catch (err) {
      setError(err.message);
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
            <h1>Seni Chat</h1>
            <p className="lede" style={{ margin: 0 }}>Sign in to your account</p>
          </div>
        </div>
        {error ? <div className="error">{error}</div> : null}
        <label htmlFor="login">Username or email</label>
        <input
          id="login"
          autoComplete="username"
          value={loginValue}
          onChange={(e) => setLoginValue(e.target.value)}
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="btn block" disabled={busy} type="submit">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="muted" style={{ marginTop: 16, textAlign: 'center' }}>
          New here? <Link href="/register">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
