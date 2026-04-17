'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  ShoppingBasket,
  Lock,
  Unlock,
  Heart,
  ArrowRightLeft,
  Clock,
  Users,
  Star,
  ArrowRight,
  List,
  UtensilsCrossed,
  RotateCcw,
} from 'lucide-react';
import { plansApi, favoritesApi, type Plan, type PlanMeal, type FavoriteRecipe } from '@/lib/api';
import { MonthlyCalendar } from '@/components/MonthlyCalendar';
import { useWeekStartDay } from '@/hooks/useWeekStartDay';
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

const DAY_BY_INDEX = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

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

function dateToWeekOffset(monday: Date): number {
  const thisMonday = getWeekStart(0);
  const diff = monday.getTime() - thisMonday.getTime();
  return Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

function getWeeksInMonth(year: number, month: number): Date[] {
  const weeks: Date[] = [];
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  const cursor = new Date(firstOfMonth);
  const day = cursor.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  cursor.setDate(cursor.getDate() + diff);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= lastOfMonth) {
    weeks.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

function weekLabel(offset: number): string {
  if (offset === 0) return 'This week';
  if (offset === 1) return 'Next week';
  if (offset === -1) return 'Last week';
  if (offset > 1) return `In ${offset} weeks`;
  return `${Math.abs(offset)} weeks ago`;
}

function getFirstMondayOfMonth(year: number, month: number): Date {
  const d = new Date(year, month, 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
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
  const { weekStartsOn } = useWeekStartDay();
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

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [monthPlans, setMonthPlans] = useState<Record<string, Plan | null>>({});

  const loadMonthPlans = useCallback(async (year: number, month: number) => {
    const weeks = getWeeksInMonth(year, month);
    const results = await Promise.all(
      weeks.map(async (w) => {
        const iso = toISODate(w);
        const plan = await plansApi.current(iso);
        return [iso, plan] as [string, Plan | null];
      }),
    );
    setMonthPlans((prev) => {
      const next = { ...prev };
      for (const [iso, plan] of results) next[iso] = plan;
      return next;
    });
  }, []);

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
      if (current) {
        setMonthPlans((prev) => ({ ...prev, [weekStart]: current }));
      }
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
    loadMonthPlans(calYear, calMonth);
  }, [loadMonthPlans, calYear, calMonth]);

  useEffect(() => {
    const weekDate = getWeekStart(weekOffset);
    const weekYear = weekDate.getFullYear();
    const weekMonth = weekDate.getMonth();
    if (weekYear !== calYear || weekMonth !== calMonth) {
      setCalYear(weekYear);
      setCalMonth(weekMonth);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

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
      const weekStartISO = toISODate(getWeekStart(weekOffset));
      setMonthPlans((prev) => ({ ...prev, [weekStartISO]: updated }));
    } finally {
      setLoading(false);
    }
  }

  const isConfirmed = plan?.status === 'confirmed';

  const weekStart = getWeekStart(weekOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekRangeLabel = `${weekStart.toLocaleDateString('en-NL', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-NL', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  function handleWeekSelect(monday: Date, day: Date) {
    const dayName = DAY_BY_INDEX[day.getDay()] ?? null;
    const offset = dateToWeekOffset(monday);
    if (offset === weekOffset) {
      const meal = plan?.meals.find((m) => m.day === dayName);
      if (meal) setSelected(meal);
    } else {
      pendingDayRef.current = dayName;
      setWeekOffset(offset);
    }
  }

  function handleMonthChange(year: number, month: number) {
    setCalYear(year);
    setCalMonth(month);
    setWeekOffset(dateToWeekOffset(getFirstMondayOfMonth(year, month)));
  }

  // Calculate stats
  const plannedDays = plan?.meals.length ?? 0;
  const ingredientsCount =
    plan?.meals.reduce((acc, meal) => acc + meal.recipe.ingredients.length, 0) ?? 0;

  // Get featured recipe (first meal or selected)
  const featuredMeal = selected ?? plan?.meals[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Calendar & Weekly Summary */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        {/* Calendar */}
        <div className="hidden lg:block">
          <MonthlyCalendar
            year={calYear}
            month={calMonth}
            selectedWeekStart={getWeekStart(weekOffset)}
            monthPlans={monthPlans}
            onWeekSelect={handleWeekSelect}
            onMonthChange={handleMonthChange}
            weekStartsOn={weekStartsOn}
          />
        </div>

        {/* Mobile Week Navigation */}
        <div className="lg:hidden bg-surface-container-lowest rounded-xl shadow-[0_12px_32px_rgba(28,28,24,0.06)] p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="p-2 hover:bg-surface-container rounded-full transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-on-surface-variant" />
            </button>
            <div className="text-center">
              <h2 className="text-lg font-bold text-primary font-headline">
                {weekLabel(weekOffset)}
              </h2>
              <p className="text-sm text-on-surface-variant">{weekRangeLabel}</p>
            </div>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="p-2 hover:bg-surface-container rounded-full transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-on-surface-variant" />
            </button>
          </div>
        </div>

        {/* Meal Overview */}
        <section className="bg-surface-container-low rounded-xl p-6 shadow-[0_12px_32px_rgba(28,28,24,0.06)]">
          <h3 className="text-xl font-bold text-primary font-headline mb-6">Meal Overview</h3>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center p-4 bg-surface-container-lowest rounded-xl">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-secondary" />
                <span className="text-sm font-medium text-on-surface">Planned Days</span>
              </div>
              <span className="text-lg font-bold text-primary">{plannedDays}/7</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-surface-container-lowest rounded-xl">
              <div className="flex items-center gap-3">
                <ShoppingBasket className="w-5 h-5 text-secondary" />
                <span className="text-sm font-medium text-on-surface">Ingredients</span>
              </div>
              <span className="text-lg font-bold text-primary">{ingredientsCount}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            {!isConfirmed ? (
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="w-full py-4 px-6 btn-primary-gradient text-on-primary font-bold rounded-full shadow-lg active:scale-95 transition-transform disabled:opacity-50"
              >
                {confirming ? 'Confirming…' : 'Confirm'}
              </button>
            ) : (
              <button
                onClick={() => setShowUnlockDialog(true)}
                className="w-full py-4 px-6 btn-primary-gradient text-on-primary font-bold rounded-full shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4" />
                Unlock
              </button>
            )}
            <button
              onClick={() => plan && router.push(`/plan/${plan.id}/grocery`)}
              className="w-full py-4 px-6 bg-surface-container-high text-on-surface font-bold rounded-full active:scale-95 transition-transform hover:bg-surface-container"
            >
              Grocery list
            </button>
          </div>
        </section>
      </div>

      {/* Right Column: This Week & Featured Recipe */}
      <div className="lg:col-span-8 space-y-8">
        {/* Header */}
        <header className="hidden lg:flex flex-col gap-2">
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
                  <div className="h-64 md:h-80 relative overflow-hidden">
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

            {/* Bento Grid: Ingredients + Week at a Glance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:auto-rows-fr">
              {/* Ingredients List */}
              {featuredMeal && (
                <section className="bg-surface-container-low rounded-2xl p-6 flex flex-col min-h-[400px]">
                  <h3 className="text-xl font-bold text-primary font-headline mb-4 flex items-center gap-2 flex-shrink-0">
                    <List className="w-5 h-5" />
                    Ingredients
                  </h3>
                  <ul className="space-y-3 flex-1 overflow-y-auto pr-2">
                    {featuredMeal.recipe.ingredients.map((ri) => (
                      <li
                        key={ri.id}
                        className="flex items-start gap-3 pb-3 border-b border-outline-variant/20 last:border-0"
                      >
                        <span className="w-2 h-2 rounded-full bg-secondary mt-1.5 flex-shrink-0" />
                        <span className="text-sm text-on-surface">
                          <span className="font-semibold">
                            {ri.amount} {ri.unit?.symbol || ''}
                          </span>{' '}
                          {ri.ingredient.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Week at a Glance */}
              <section className="flex flex-col gap-4">
                <h3 className="text-xl font-bold text-primary font-headline flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5" />
                  Week at a Glance
                </h3>
                <div className="space-y-3">
                  {plan.meals.map((meal) => {
                    const isSelected = selected?.id === meal.id;
                    return (
                      <div
                        key={meal.id}
                        onClick={() => setSelected(meal)}
                        className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-secondary-container/20 border border-secondary/20'
                            : 'hover:bg-surface-container'
                        }`}
                      >
                        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-sm relative">
                          <RecipeImage
                            title={meal.recipe.title}
                            imageUrl={meal.recipe.imageUrl}
                            size="small"
                          />
                        </div>
                        <div className="flex-grow min-w-0">
                          <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">
                            {DAY_LABELS_FULL[meal.day]}
                          </p>
                          <h4
                            className={`font-bold truncate ${isSelected ? 'text-primary' : 'text-on-surface hover:text-secondary'} transition-colors`}
                          >
                            {meal.recipe.title}
                          </h4>
                          <span className="text-xs text-on-surface-variant">
                            {meal.recipe.cookTimeMinutes}m •{' '}
                            {meal.recipe.tags[0]?.tag.slug.replace('_', ' ') || 'Meal'}
                          </span>
                        </div>
                        {isSelected ? (
                          <Star className="w-5 h-5 text-secondary fill-secondary" />
                        ) : (
                          <ArrowRight className="w-5 h-5 text-outline-variant opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                        {meal.isLocked && <Lock className="w-4 h-4 text-secondary" />}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

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
