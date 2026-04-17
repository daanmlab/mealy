'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/auth';
import MealyLogo from '@/components/MealyLogo';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/plan');
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="max-w-md mx-auto bg-surface-container-lowest rounded-xl p-8 md:p-12 shadow-ambient">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 mb-6 relative group">
            <div className="absolute inset-0 bg-primary/10 rounded-2xl rotate-6 transition-transform group-hover:rotate-12 duration-300" />
            <div className="absolute inset-0 bg-primary flex items-center justify-center rounded-2xl">
              <MealyLogo size={36} className="[&_path:first-child]:fill-on-primary [&_path:last-child]:fill-on-primary" style={{ filter: 'brightness(0) invert(1)' }} />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tighter text-primary mb-1">Mealy</h1>
          <p className="text-on-surface-variant font-medium text-sm">The Culinary Atelier</p>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-on-surface mb-1">Welcome back</h2>
          <p className="text-on-surface-variant text-sm">Please enter your details to continue your journey.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant ml-1" htmlFor="email">
              Email address
            </label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline-variant group-focus-within:text-secondary transition-colors" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="chef@mealy.app"
                className="w-full pl-12 pr-4 py-4 bg-surface-container-low border-transparent focus:border-secondary focus:ring-2 focus:ring-secondary/15 rounded-xl text-on-surface transition-all placeholder:text-outline-variant outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant" htmlFor="password">
                Password
              </label>
              {/* TODO: implement */}
              {/* <a href="#" className="text-xs font-bold text-secondary hover:underline">Forgot password?</a> */}
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline-variant group-focus-within:text-secondary transition-colors" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-12 pr-4 py-4 bg-surface-container-low border-transparent focus:border-secondary focus:ring-2 focus:ring-secondary/15 rounded-xl text-on-surface transition-all placeholder:text-outline-variant outline-none"
              />
            </div>
          </div>

          {error && <p className="text-error text-sm px-1">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 btn-primary-gradient text-white font-bold rounded-full shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-60"
          >
            <span>{loading ? 'Signing in…' : 'Sign in'}</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-outline-variant/30" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-widest">
            <span className="bg-surface-container-lowest px-4 text-outline-variant font-medium">Or continue with</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => signIn('google', { callbackUrl: '/plan' })}
          className="w-full py-3.5 flex items-center justify-center gap-3 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-semibold rounded-full transition-colors active:scale-[0.98]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span>Google</span>
        </button>

        <div className="mt-10 text-center">
          <p className="text-sm text-on-surface-variant">
            No account?{' '}
            <Link href="/register" className="text-secondary font-bold hover:underline ml-1 transition-all">
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Decorative food images — desktop only */}
      <div className="fixed top-12 left-12 hidden lg:block max-w-[200px] pointer-events-none">
        <div className="aspect-[3/4] rounded-xl overflow-hidden shadow-2xl rotate-[-4deg]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDrjXFnaFC08U52oGRqZ-mYe7IfHt66HXcZYcHY_wANTmWqSmaZlRRPkmIpxxI_oBr4bq7uB_jwqKNdYPhnjyk5v2ZRnNeWkssJUNykmXRApHmGupbBggluRMOfNFrJDn5Nrsl0r_-rPUX61WUsS0f1TXt3M_OL_vcnVhHPxP5SKOcBRJhh7pqI4ubRT7RyafqSsugXuwVahDl6_Bs-71Uc1zezzHs9nMGpPBnfyeaoEWu77eM73j5Uadidt5NeIlCkAKvY6yr7VQ"
            alt="Vibrant Mediterranean roasted vegetables"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
      <div className="fixed bottom-12 right-12 hidden lg:block max-w-[240px] pointer-events-none">
        <div className="aspect-square rounded-xl overflow-hidden shadow-2xl rotate-[3deg]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAb5U1lkK7VHKISlkQ7ehH3cB9gbmS9BmX9eQswQwYSOTDGK_Ah3ADtbZBQW-TQpFZezAuAEj45HPTml-l_VdpKieylOWZ4HBJ0ywHzWzrtpELPIBeIFijeiTUfwyAY__Xy6v0wO5h64PTjFi0V6Ld-v0t2h7-cPgUEnsFXF8Y0uZAee2nagN8Bxxtg5Krm_rjdoDkKSC4fSLsvEBGEWv01XehL9ByYM9JPiPrQSaWUPsk7HZS6_A2bzqzDxLJHDdE__3wBjbWJBg"
            alt="Gourmet salad with edible flowers and microgreens"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </>
  );
}
