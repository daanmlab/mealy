'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/auth';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(email, password, name);
      router.push('/onboarding');
    } catch {
      setError('Could not create account. Email may already be in use.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto grid md:grid-cols-2 bg-surface-container-lowest rounded-xl overflow-hidden shadow-ambient">
      {/* Left: editorial food image */}
      <section className="hidden md:block relative h-full min-h-[600px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBV8xrAi2UKlT13rJ8pzx-dgAisavo1H8j5us_8Jdln39C5IPFqS8nOFjHpsn1M8Cp1Z3500eqWJEkLoy3EOR8UiLt1pTA7S_m18Sw5HmBdR8wuWbwr6qcUiI73E4N12ssw8EljbFO07jhEQrfYhgX32reAzIy0vZTrG5A7ENgIU4TbW096QneKV4-ahm8sZBlBQevQYwaQz6L2QtgfwSzw84KwMrmF6oVqvznR4-crLg5-pQIOuqt_FJEvgQG0ZN5v4YfGu8TljQ"
          alt="Fresh organic vegetables and herbs on marble"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-primary/20" />
        <div className="absolute bottom-12 left-12 right-12 p-8 glass rounded-xl">
          <span className="text-primary font-bold text-sm tracking-widest mb-2 block">THE CULINARY ATELIER</span>
          <h2 className="text-3xl font-extrabold text-on-surface leading-tight">Elevate your daily dining to an art form.</h2>
          <p className="text-on-surface-variant mt-3 text-sm leading-relaxed">Join a community where nutrition meets curated editorial design, making every meal a masterpiece.</p>
        </div>
      </section>

      {/* Right: registration form */}
      <section className="p-8 md:p-16 flex flex-col justify-center">
        <div className="mb-10 text-center md:text-left">
          <div className="font-headline text-2xl font-black text-primary tracking-tighter mb-8">Mealy</div>
          <h1 className="text-4xl font-extrabold text-on-surface tracking-tight leading-tight mb-2">Create your account</h1>
          <p className="text-on-surface-variant font-medium">Start planning better meals today</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-2 px-1" htmlFor="name">
              Full Name
            </label>
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline group-focus-within:text-secondary transition-colors" />
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Julianne Voisier"
                className="w-full pl-11 pr-4 py-3.5 bg-surface-container-low border-none focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-lowest transition-all rounded-xl text-on-surface placeholder:text-outline/50 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-2 px-1" htmlFor="email">
              Email Address
            </label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline group-focus-within:text-secondary transition-colors" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="julianne@atelier.com"
                className="w-full pl-11 pr-4 py-3.5 bg-surface-container-low border-none focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-lowest transition-all rounded-xl text-on-surface placeholder:text-outline/50 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-on-surface-variant mb-2 px-1" htmlFor="password">
              Password
            </label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-outline group-focus-within:text-secondary transition-colors" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-11 pr-12 py-3.5 bg-surface-container-low border-none focus:ring-2 focus:ring-secondary/20 focus:bg-surface-container-lowest transition-all rounded-xl text-on-surface placeholder:text-outline/50 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 px-1">
            <input
              id="terms"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="w-5 h-5 rounded-md border-outline-variant text-secondary focus:ring-secondary/20 bg-surface-container-low"
            />
            <label className="text-sm text-on-surface-variant" htmlFor="terms">
              I agree to the{' '}
              <a href="#" className="text-secondary font-semibold hover:underline">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="text-secondary font-semibold hover:underline">Privacy Policy</a>
            </label>
          </div>

          {error && <p className="text-error text-sm px-1">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary-gradient text-white font-bold py-4 px-6 rounded-full shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Create account'}
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        <div className="relative my-10">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-outline-variant/30" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-surface-container-lowest text-outline italic">or join with</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => signIn('google', { callbackUrl: '/onboarding' })}
          className="flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors text-sm font-semibold text-on-surface w-full"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Google
        </button>

        <div className="mt-12 text-center">
          <p className="text-on-surface-variant font-medium">
            Already have an account?{' '}
            <Link href="/login" className="text-secondary font-bold hover:underline ml-1">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
