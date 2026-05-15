'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  Heart,
  ArrowRightLeft,
  Clock,
  Users,
  UtensilsCrossed,
  RotateCcw,
} from 'lucide-react';
import { plansApi, favoritesApi, type Plan, type PlanMeal, type FavoriteRecipe } from '@/lib/api';

import SwapPickerModal from '@/components/SwapPickerModal';

const DAY_LABELS_FULL: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const ORDERED_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function getWeekStart(offset = 0): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0] as string;
}

function weekLabel(offset: number): string {
  if (offset === 0) return 'This week';
  if (offset === 1) return 'Next week';
  if (offset === -1) return 'Last week';
  if (offset > 1) return `In ${offset} weeks`;
  return `${Math.abs(offset)} weeks ago`;
}

function RecipeImage({
  title,
  imageUrl,
  className = '',
  size = 'small',
}: {
  title: string;
  imageUrl?: string | null;
  className?: string;
  size?: 'small' | 'large';
}) {
  if (imageUrl) {
    return (
      <Image src={imageUrl} alt={title} fill className={`object-cover block ${className}`} />
    );
  }

  return (
    <div
      className={`w-full h-full flex items-center justify-center bg-surface-container ${className}`}
    >
      <UtensilsCrossed
        className={`text-on-surface-variant/30 ${size === 'large' ? 'w-12 h-12' : 'w-6 h-6'}`}
      />
    </div>
  );
}

export default function PlanPage() {
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [swapTarget, setSwapTarget] = useState<PlanMeal | null>(null);
  const [selected, setSelected] = useState<PlanMeal | null>(null);
  const pendingDayRef = useRef<string | null>(null);

  const loadPlan = useCallback(async (offset: number) => {
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const weekStart = toISODate(getWeekStart(offset));
      let current = await plansApi.current(weekStart);
      if (!current) current = await plansApi.create(weekStart);
      setPlan(current);
      const day = pendingDayRef.current;
      pendingDayRef.current = null;
      setSelected(
        (prev) =>
          (day ? current?.meals.find((m) => m.day === day) : null) ??
          current?.meals.find((m) => m.id === prev?.id) ??
          current?.meals[0] ??
          null,
      );
    } catch {
      setError('Failed to load your plan. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlan(weekOffset);
  }, [loadPlan, weekOffset]);

  useEffect(() => {
    favoritesApi
      .list()
      .then((favs: FavoriteRecipe[]) => setFavorites(new Set(favs.map((f) => f.recipeId))));
  }, []);

  async function handleSwapWithRecipe(meal: PlanMeal, recipeId: string) {
    if (!plan) return;
    const updated = await plansApi.swap(plan.id, meal.id, recipeId);
    setPlan((p) => {
      if (!p) return p;
      const meals = p.meals.map((m) => (m.id === meal.id ? { ...m, recipe: updated.recipe } : m));
      return { ...p, meals };
    });
    setSelected((s) => (s?.id === meal.id ? { ...s, recipe: updated.recipe } : s));
    setSwapTarget(null);
  }

  async function handleLock(meal: PlanMeal) {
    if (!plan) return;
    const updated = await plansApi.lock(plan.id, meal.id);
    setPlan((p) => {
      if (!p) return p;
      const meals = p.meals.map((m) =>
        m.id === meal.id ? { ...m, isLocked: updated.isLocked } : m,
      );
      return { ...p, meals };
    });
    setSelected((s) => (s?.id === meal.id ? { ...s, isLocked: updated.isLocked } : s));
  }

  async function handleFavorite(recipeId: string) {
    if (favorites.has(recipeId)) {
      await favoritesApi.remove(recipeId);
      setFavorites((f) => {
        const n = new Set(f);
        n.delete(recipeId);
        return n;
      });
    } else {
      await favoritesApi.add(recipeId);
      setFavorites((f) => new Set(f).add(recipeId));
    }
  }

  async function handleUnlock() {
    if (!plan) return;
    setUnlocking(true);
    try {
      const updated = await plansApi.unlock(plan.id);
      setPlan(updated);
      setShowUnlockDialog(false);
    } finally {
      setUnlocking(false);
    }
  }

  async function handleConfirm() {
    if (!plan) return;
    setConfirming(true);
    try {
      const confirmed = await plansApi.confirm(plan.id);
      setPlan(confirmed);
      router.push(`/plan/${plan.id}/grocery`);
    } finally {
      setConfirming(false);
    }
  }

  async function handleRegenerate() {
    if (!plan) return;
    setLoading(true);
    try {
      const updated = await plansApi.regenerate(plan.id);
      setPlan(updated);
      setSelected(updated.meals[0] ?? null);
    } finally {
      setLoading(false);
    }
  }

  const isConfirmed = plan?.status === 'confirmed';

  const weekStart = getWeekStart(weekOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekRangeLabel = `${weekStart.toLocaleDateString('en-NL', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-NL', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  // Get featured recipe (first meal or selected)
  const featuredMeal = selected ?? plan?.meals[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Day tabs + actions */}
      <div className="lg:col-span-3 flex flex-col gap-4">

        {/* Vertical day tabs */}
        <div className="bg-surface-container rounded-2xl p-1.5 flex flex-col gap-1">
          {ORDERED_DAYS.map((day) => {
            const meal = plan?.meals.find((m) => m.day === day);
            const isSelected = selected?.day === day;
            return (
              <button
                key={day}
                onClick={() => meal && setSelected(meal)}
                disabled={!meal}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                  isSelected
                    ? 'bg-surface-container-lowest shadow-sm'
                    : meal
                      ? 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                      : 'text-outline/30 cursor-not-allowed'
                }`}
              >
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className={`font-semibold text-xs ${isSelected ? 'text-secondary' : ''}`}>
                    {DAY_LABELS_FULL[day]}
                  </span>
                  {meal ? (
                    <span className={`truncate text-xs ${isSelected ? 'text-primary font-medium' : 'text-on-surface-variant'}`}>
                      {meal.recipe.title}
                    </span>
                  ) : (
                    <span className="text-xs text-outline/40">
                      No meal &middot;{' '}
                      <Link href="/settings" className="text-secondary/70 hover:text-secondary hover:underline">
                        adjust in settings
                      </Link>
                    </span>
                  )}
                </div>
                {meal?.isLocked && <Lock className="w-3 h-3 text-secondary shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {!isConfirmed ? (
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full py-3 px-6 btn-primary-gradient text-on-primary font-bold rounded-full shadow-lg active:scale-95 transition-transform disabled:opacity-50"
            >
              {confirming ? 'Confirming…' : 'Confirm week'}
            </button>
          ) : (
            <button
              onClick={() => setShowUnlockDialog(true)}
              className="w-full py-3 px-6 btn-primary-gradient text-on-primary font-bold rounded-full shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              <Unlock className="w-4 h-4" />
              Unlock
            </button>
          )}
          <div className="relative group/grocery w-full">
            <button
              onClick={() => plan && router.push(`/plan/${plan.id}/grocery`)}
              disabled={!isConfirmed}
              className="w-full py-3 px-6 bg-surface-container-high text-on-surface font-bold rounded-full active:scale-95 transition-transform hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              Grocery list
            </button>
            {!isConfirmed && (
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover/grocery:opacity-100 transition-opacity duration-150 z-10">
                <div className="bg-inverse-surface text-inverse-on-surface text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                  Confirm the week first
                </div>
                <div className="w-2 h-2 bg-inverse-surface rotate-45 mx-auto -mt-1" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Header + Featured Recipe */}
      <div className="lg:col-span-9 space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="p-2 hover:bg-surface-container rounded-full transition-colors"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-5 h-5 text-on-surface-variant" />
            </button>
            <div>
              <h1 className="text-4xl font-extrabold text-primary font-headline tracking-tight">
                {weekLabel(weekOffset)}
              </h1>
              <p className="text-lg text-on-surface-variant mt-1">{weekRangeLabel}</p>
            </div>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="p-2 hover:bg-surface-container rounded-full transition-colors"
              aria-label="Next week"
            >
              <ChevronRight className="w-5 h-5 text-on-surface-variant" />
            </button>
          </div>
        </header>

        {loading ? (
          <div className="space-y-6">
            <div className="h-64 bg-surface-container rounded-2xl animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-48 bg-surface-container rounded-2xl animate-pulse" />
              <div className="h-48 bg-surface-container rounded-2xl animate-pulse" />
            </div>
          </div>
        ) : error ? (
          <div className="bg-error-container rounded-2xl p-8 text-center">
            <p className="text-error font-medium">{error}</p>
          </div>
        ) : !plan ? null : (
          <>
            {/* Featured Recipe Card */}
            {featuredMeal && (
              <section className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0_12px_32px_rgba(28,28,24,0.06)]">
                <div className="grid grid-cols-1 md:grid-cols-2">
                  <div className="min-h-64 md:min-h-80 relative overflow-hidden">
                    <RecipeImage
                      title={featuredMeal.recipe.title}
                      imageUrl={featuredMeal.recipe.imageUrl}
                      size="large"
                    />
                    <div className="absolute top-4 left-4 bg-secondary text-on-secondary px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
                      {isConfirmed ? 'Confirmed' : 'Recommended'}
                    </div>
                  </div>
                  <div className="p-6 md:p-8 flex flex-col justify-center gap-4">
                    <div>
                      <Link
                        href={`/recipes/${featuredMeal.recipe.id}`}
                        className="text-2xl md:text-3xl font-extrabold text-primary font-headline hover:text-secondary transition-colors block"
                      >
                        {featuredMeal.recipe.title}
                      </Link>
                      <p className="text-on-surface-variant leading-relaxed mt-2 italic">
                        {featuredMeal.recipe.description}
                      </p>
                    </div>
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-secondary" />
                        <span className="text-sm font-semibold text-on-surface">
                          {featuredMeal.recipe.cookTimeMinutes} min
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-secondary" />
                        <span className="text-sm font-semibold text-on-surface">
                          {featuredMeal.recipe.servings} servings
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {featuredMeal.recipe.tags.slice(0, 3).map((t) => (
                        <span
                          key={t.tag.slug}
                          className="px-3 py-1 bg-surface-container text-on-surface-variant text-xs font-medium rounded-full"
                        >
                          {t.tag.slug.replace('_', ' ')}
                        </span>
                      ))}
                    </div>

                    {/* Action buttons for featured recipe */}
                    {!isConfirmed && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleFavorite(featuredMeal.recipe.id)}
                          className={`p-2.5 rounded-xl transition-colors ${
                            favorites.has(featuredMeal.recipe.id)
                              ? 'bg-tertiary-container text-tertiary'
                              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                          }`}
                          title="Favorite"
                        >
                          <Heart
                            className={`w-5 h-5 ${favorites.has(featuredMeal.recipe.id) ? 'fill-current' : ''}`}
                          />
                        </button>
                        <button
                          onClick={() => handleLock(featuredMeal)}
                          className={`p-2.5 rounded-xl transition-colors ${
                            featuredMeal.isLocked
                              ? 'bg-secondary-container text-secondary'
                              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                          }`}
                          title={featuredMeal.isLocked ? 'Unlock' : 'Lock'}
                        >
                          {featuredMeal.isLocked ? (
                            <Lock className="w-5 h-5" />
                          ) : (
                            <Unlock className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => setSwapTarget(featuredMeal)}
                          disabled={featuredMeal.isLocked}
                          className="p-2.5 rounded-xl bg-surface-container text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30 transition-colors"
                          title="Swap"
                        >
                          <ArrowRightLeft className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Regenerate Button */}
            {!isConfirmed && (
              <button
                onClick={handleRegenerate}
                className="w-full py-4 border border-dashed border-outline-variant rounded-xl text-sm text-on-surface-variant hover:border-secondary hover:text-secondary transition-colors flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Regenerate all meals
              </button>
            )}
          </>
        )}

        {/* Unlock Dialog */}
        {showUnlockDialog && (
          <div className="fixed inset-0 bg-on-surface/40 flex items-center justify-center z-50 p-4">
            <div className="bg-surface-container-lowest rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-[0_12px_32px_rgba(28,28,24,0.08)]">
              <h2 className="text-lg font-bold text-primary font-headline">Unlock this week?</h2>
              <p className="text-sm text-on-surface-variant">
                This will re-open the plan for editing. Your grocery list will remain available but
                the plan will return to draft status.
              </p>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowUnlockDialog(false)}
                  className="flex-1 py-2.5 border border-outline-variant rounded-xl text-sm font-semibold text-on-surface-variant hover:border-outline transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnlock}
                  disabled={unlocking}
                  className="flex-1 py-2.5 bg-secondary text-on-secondary rounded-xl text-sm font-semibold hover:bg-secondary/90 disabled:opacity-50 transition-colors"
                >
                  {unlocking ? 'Unlocking…' : 'Yes, unlock'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {swapTarget && plan && (
        <SwapPickerModal
          plan={plan}
          meal={swapTarget}
          onSwap={(recipeId) => handleSwapWithRecipe(swapTarget, recipeId)}
          onClose={() => setSwapTarget(null)}
        />
      )}
    </div>
  );
}
