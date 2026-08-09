'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, setToken, setUser, ApiError } from '@/lib/api';
import { Logo } from '@/components/Logo';

export function AuthCard({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: { id: string; username: string } }>(
        mode === 'login' ? '/auth/login' : '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        }
      );
      setToken(res.token);
      setUser(res.user);
      router.push('/app');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 flex justify-center">
        <Logo size={36} />
      </div>
      <div className="card p-8">
        <h1 className="text-2xl font-bold text-white">{mode === 'login' ? 'Welcome back' : 'Create your workspace'}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {mode === 'login' ? 'Log in to search your collections.' : 'Free. No email required.'}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. alice_dev"
              autoComplete="username"
              required
              minLength={3}
              maxLength={24}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          {mode === 'login' ? (
            <>
              New here?{' '}
              <Link href="/register" className="font-semibold text-accent-400 hover:underline">
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-accent-400 hover:underline">
                Log in
              </Link>
            </>
          )}
        </p>
      </div>
      <p className="mt-6 text-center text-xs text-slate-600">
        Your documents stay in your workspace. Sessions expire after 30 days.
      </p>
    </div>
  );
}
