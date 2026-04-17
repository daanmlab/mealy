'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { useAuth } from '@/contexts/auth';
import MealyLogo from '@/components/MealyLogo';

export default function RegisterPage() {
  const { user, register, convertGuest } = useAuth();
  const { data: session } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isGuest = user?.isGuest === true;

  function handleGoogleSignIn() {
    if (isGuest && user?.id) {
      sessionStorage.setItem('pendingGuestMerge', user.id);
      if (session?.user?.guestMergeToken) {
        sessionStorage.setItem('pendingGuestMergeToken', session.user.guestMergeToken);
      }
    }
    signIn('google', { callbackUrl: '/plan' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (isGuest) {
        await convertGuest(email, password, name || undefined);
        router.push('/plan');
      } else {
        await register(email, password, name);
        router.push('/onboarding');
      }
    } catch {
      setError(
        isGuest
          ? 'Could not save your account. Email may already be in use.'
          : 'Could not create account. Email may already be in use.',
      );
    } finally {
      setLoading(false);
    }
  }

  const submitLabel = isGuest ? 'Save my progress' : 'Create account';
  const loadingLabel = isGuest ? 'Saving…' : 'Creating account…';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <MealyLogo size={52} />
        </div>
        {isGuest ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900">Save your progress</h1>
            <p className="text-gray-500 mt-1 text-sm">Create an account to keep your plans &amp; favorites</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
            <p className="text-gray-500 mt-1 text-sm">Start planning better meals today</p>
          </>
        )}
      </div>

      {isGuest && (
        <div className="mb-4">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">or use email</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-olive focus:border-transparent"
            placeholder="Your name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-olive focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-olive focus:border-transparent"
            placeholder="At least 8 characters"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-olive text-white rounded-lg font-medium text-sm hover:bg-olive-dark disabled:opacity-50 transition-colors"
        >
          {loading ? loadingLabel : submitLabel}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="text-olive hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
