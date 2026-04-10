'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import { Suspense } from 'react';

function CallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();
  const { loginWithToken } = useAuth();

  useEffect(() => {
    const token = params.get('token');
    const rt = params.get('rt');
    if (!token) {
      router.replace('/login');
      return;
    }
    loginWithToken(token, rt ?? undefined)
      .then((user) => {
        router.replace(user.onboardingDone ? '/plan' : '/onboarding');
      })
      .catch(() => router.replace('/login'));
  }, [params, router, loginWithToken]);

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
