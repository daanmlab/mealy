'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import MealyLogo from '@/components/MealyLogo';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = [
    { href: '/plan', label: 'Plan', icon: '📅' },
    { href: '/recipes', label: 'Recipes', icon: '🍽' },
    { href: '/favorites', label: 'Favorites', icon: '♥' },
    { href: '/settings', label: 'Settings', icon: '⚙' },
    ...(user?.isAdmin ? [{ href: '/admin', label: 'Admin', icon: '🛠' }] : []),
  ];

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (!user.onboardingDone && pathname !== '/onboarding') router.replace('/onboarding');
  }, [loading, user, pathname, router]);

  if (loading || !user || (!user.onboardingDone && pathname !== '/onboarding')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <MealyLogo size={72} style={{ animation: 'logo-pulse 1.6s ease-in-out infinite' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {pathname !== '/onboarding' && (
        <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link href="/plan" className="flex items-center gap-2">
              <MealyLogo size={28} />
              <span className="font-bold text-olive text-lg tracking-tight">mealy</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden sm:flex gap-1">
              {nav.map(({ href, label, icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    pathname.startsWith(href)
                      ? 'bg-olive-subtle text-olive'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <span className="mr-1">{icon}</span>
                  {label}
                </Link>
              ))}
              <button
                onClick={() => {
                  void logout();
                }}
                className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Sign out
              </button>
            </nav>

            {/* Mobile hamburger */}
            <button
              className="sm:hidden p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {/* Mobile menu */}
          {mobileOpen && (
            <nav className="sm:hidden border-t border-gray-100 px-4 py-2 flex flex-col gap-1">
              {nav.map(({ href, label, icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname.startsWith(href)
                      ? 'bg-olive-subtle text-olive'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <span className="mr-2">{icon}</span>
                  {label}
                </Link>
              ))}
              <button
                onClick={() => {
                  setMobileOpen(false);
                  void logout();
                }}
                className="px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-600 transition-colors text-left"
              >
                Sign out
              </button>
            </nav>
          )}
        </header>
      )}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 pt-[1.5em]">{children}</main>
    </div>
  );
}
