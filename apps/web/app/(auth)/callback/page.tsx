'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setAccessToken, usersApi } from '@/lib/api';
import { useAuth } from '@/contexts/auth';
import { Suspense } from 'react';

function CallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setAccessToken(token);
    usersApi
      .me()
      .then(async (user) => {
        await refreshUser();
        router.replace(user.onboardingDone ? '/plan' : '/onboarding');
      })
      .catch(() => router.replace('/login'));
  }, [params, router, refreshUser]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-500 text-sm">Signing you in…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  );
}
