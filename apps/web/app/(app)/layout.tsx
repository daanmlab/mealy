'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import MealyLogo from '@/components/MealyLogo';
import { Calendar, UtensilsCrossed, Heart, Settings, Wrench, Menu, X, LogOut } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const nav = useMemo(
    () => [
      { href: '/plan', label: 'Plan', icon: Calendar },
      { href: '/recipes', label: 'Recipes', icon: UtensilsCrossed },
      { href: '/favorites', label: 'Favorites', icon: Heart },
      { href: '/settings', label: 'Settings', icon: Settings },
      ...(user?.isAdmin ? [{ href: '/admin', label: 'Admin', icon: Wrench }] : []),
    ],
    [user?.isAdmin],
  );

  const toggleMobile = () => setMobileOpen(!mobileOpen);

  useEffect(() => {
    const container = navRef.current;
    if (!container) return;

    const active = nav.find(({ href }) => pathname.startsWith(href))?.href;
    if (!active) return;

    const link = container.querySelector(`a[href="${active}"]`) as HTMLAnchorElement;
    if (!link) return;

    const containerRect = container.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();

    setIndicator({
      left: linkRect.left - containerRect.left,
      width: linkRect.width,
    });
  }, [pathname, nav]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!user.onboardingDone && pathname !== '/onboarding') router.replace('/onboarding');
  }, [loading, user, pathname, router]);

  if (loading || !user || (!user.onboardingDone && pathname !== '/onboarding')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <MealyLogo size={72} style={{ animation: 'logo-pulse 1.6s ease-in-out infinite' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col font-body">
      {pathname !== '/onboarding' && (
        <header className="fixed top-0 w-full z-50 glass shadow-[0_12px_32px_rgba(28,28,24,0.06)] h-20">
          <div className="max-w-[1920px] mx-auto px-6 md:px-12 h-full flex items-center justify-between">
            <div className="flex items-center gap-12">
              <Link href="/plan" className="flex items-center gap-2">
                <span className="text-2xl font-bold tracking-tighter text-primary font-headline">
                  Mealy
                </span>
              </Link>
              <nav ref={navRef} className="hidden md:flex items-center gap-8 relative">
                {nav.map(({ href, label }) => {
                  const isActive = pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`text-sm font-semibold py-3 transition-colors relative ${
                        isActive ? 'text-primary' : ''
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
                <span
                  className="absolute bottom-0 h-0.5 bg-secondary rounded-full transition-all duration-300 ease-out pointer-events-none"
                  style={{ left: indicator.left, width: indicator.width }}
                />
              </nav>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={logout}
                className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>

              <button
                className="md:hidden p-2 hover:bg-surface-container rounded-lg transition-colors"
                onClick={toggleMobile}
                aria-label="Toggle menu"
              >
                {mobileOpen ? (
                  <X className="w-5 h-5 text-on-surface" />
                ) : (
                  <Menu className="w-5 h-5 text-on-surface" />
                )}
              </button>
            </div>
          </div>

          {mobileOpen && (
            <nav className="md:hidden absolute top-20 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant/20 px-6 py-4 flex flex-col gap-2 shadow-[0_12px_32px_rgba(28,28,24,0.06)]">
              {nav.map(({ href, label, icon: Icon }) => {
                const isActive = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-secondary-container/20 text-primary'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-primary'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {label}
                  </Link>
                );
              })}
              <button
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors text-left"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </nav>
          )}
        </header>
      )}
      <main className="flex-1 max-w-[1920px] mx-auto w-full px-6 md:px-12 pt-32 pb-20">
        {children}
      </main>
    </div>
  );
}
