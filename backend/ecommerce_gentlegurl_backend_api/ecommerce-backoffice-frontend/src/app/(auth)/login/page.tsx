'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import PageHeader from '@/components/ui/PageHeader';

export default function LoginPage() {
  const { login, loading, adminUser } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login({ username, password });
      router.push('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (adminUser) {
    router.replace('/dashboard');
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md space-y-6 rounded border bg-white p-6 shadow-sm">
        <PageHeader title="Admin Login" description="Use your backoffice credentials" />
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 text-sm">
            <label className="font-medium">Username</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2 text-sm">
            <label className="font-medium">Password</label>
            <input
              className="w-full rounded border px-3 py-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </form>
      </div>
    </div>
  );
}
