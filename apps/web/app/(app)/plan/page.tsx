'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { plansApi, favoritesApi, type Plan, type PlanMeal, type FavoriteRecipe } from '@/lib/api';
import { MonthlyCalendar } from '@/components/MonthlyCalendar';
import { useWeekStartDay } from '@/hooks/useWeekStartDay';
import SwapPickerModal from '@/components/SwapPickerModal';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

// Maps Date.getDay() (0=Sun) to day name
const DAY_BY_INDEX = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

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
  const planDays = new Set(plan?.meals.map((m) => m.day) ?? []);

  const weekStart = getWeekStart(weekOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekRangeLabel = `${weekStart.toLocaleDateString('en-NL', { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString('en-NL', { day: 'numeric', month: 'short' })}`;

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

  return (
    <div className="lg:flex lg:gap-6 lg:items-start">
      {/* Monthly calendar — hidden on mobile */}
      <div className="hidden lg:block lg:w-64 lg:shrink-0 lg:sticky">
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

      {/* Week detail panel */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWeekOffset((o) => o - 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors text-sm"
                aria-label="Previous week"
              >
                ‹
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">
                  {weekLabel(weekOffset)}
                </h1>
                <p className="text-xs text-gray-400">{weekRangeLabel}</p>
              </div>
              <button
                onClick={() => setWeekOffset((o) => o + 1)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors text-sm"
                aria-label="Next week"
              >
                ›
              </button>
            </div>
          </div>

          {!loading &&
            plan &&
            (!isConfirmed ? (
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {confirming ? 'Confirming…' : 'Confirm & shop →'}
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowUnlockDialog(true)}
                  className="px-4 py-2 border border-gray-200 text-gray-500 rounded-xl text-sm font-semibold hover:border-gray-300 hover:text-gray-700 transition-colors"
                >
                  🔓 Unlock
                </button>
                <button
                  onClick={() => router.push(`/plan/${plan.id}/grocery`)}
                  className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
                >
                  Grocery list →
                </button>
              </div>
            ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
            <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        ) : !plan ? null : (
          <>
            {/* Calendar grid */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="grid grid-cols-7 border-b border-gray-100">
                {DAYS.map((day) => {
                  const meal = plan.meals.find((m) => m.day === day);
                  const isActive = planDays.has(day as (typeof plan.meals)[0]['day']);
                  const isSelected = selected?.day === day;

                  return (
                    <button
                      key={day}
                      disabled={!isActive}
                      onClick={() => meal && setSelected(meal)}
                      className={`py-3 px-1 flex flex-col items-center gap-1 transition-colors border-r last:border-r-0 border-gray-100 ${
                        !isActive
                          ? 'opacity-30 cursor-default bg-gray-50'
                          : isSelected
                            ? 'bg-green-50'
                            : 'hover:bg-gray-50'
                      }`}
                    >
                      <span
                        className={`text-[11px] font-semibold uppercase tracking-wide ${isSelected ? 'text-green-700' : 'text-gray-400'}`}
                      >
                        {DAY_LABELS[day]}
                      </span>
                      {meal && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${meal.isLocked ? 'bg-amber-400' : isSelected ? 'bg-green-500' : 'bg-gray-300'}`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected meal detail */}
              {selected && (
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/recipes/${selected.recipe.id}`}
                        className="font-semibold text-gray-900 hover:text-green-700 transition-colors leading-tight block"
                      >
                        {selected.recipe.title}
                      </Link>
                      <p className="text-sm text-gray-400 mt-1">{selected.recipe.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span>⏱ {selected.recipe.cookTimeMinutes} min</span>
                        <span>👤 {selected.recipe.servings} servings</span>
                        <div className="flex gap-1 flex-wrap">
                          {selected.recipe.tags.map((t) => (
                            <span
                              key={t.tag.slug}
                              className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 capitalize"
                            >
                              {t.tag.slug.replace('_', '-')}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {!isConfirmed && (
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button
                          onClick={() => handleFavorite(selected.recipe.id)}
                          className={`p-2 rounded-lg text-sm transition-colors ${
                            favorites.has(selected.recipe.id)
                              ? 'text-red-500 bg-red-50'
                              : 'text-gray-300 hover:text-gray-500'
                          }`}
                          title="Favorite"
                        >
                          ♥
                        </button>
                        <button
                          onClick={() => handleLock(selected)}
                          className={`p-2 rounded-lg text-sm transition-colors ${
                            selected.isLocked
                              ? 'text-amber-600 bg-amber-50'
                              : 'text-gray-300 hover:text-gray-500'
                          }`}
                          title={selected.isLocked ? 'Unlock' : 'Lock'}
                        >
                          {selected.isLocked ? '🔒' : '🔓'}
                        </button>
                        <button
                          onClick={() => setSwapTarget(selected)}
                          disabled={selected.isLocked}
                          className="p-2 rounded-lg text-gray-300 hover:text-gray-500 disabled:opacity-30 transition-colors text-sm"
                          title="Swap"
                        >
                          ⇄
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Ingredients preview */}
                  <div className="mt-4 pt-4 border-t border-gray-50">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      Ingredients
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.recipe.ingredients.map((ri) => (
                        <span
                          key={ri.id}
                          className="text-xs px-2 py-1 bg-gray-50 rounded-lg text-gray-600 capitalize"
                        >
                          {ri.ingredient.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Meal list (compact, all days) */}
            <div className="space-y-1.5">
              {plan.meals.map((meal) => (
                <button
                  key={meal.id}
                  onClick={() => setSelected(meal)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
                    selected?.id === meal.id
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-100 bg-white hover:border-gray-200'
                  }`}
                >
                  <span className="text-xs font-bold text-gray-400 uppercase w-8 shrink-0">
                    {DAY_LABELS[meal.day]}
                  </span>
                  <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                    {meal.recipe.title}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {meal.recipe.cookTimeMinutes}m
                  </span>
                  {meal.isLocked && <span className="text-xs">🔒</span>}
                </button>
              ))}
            </div>

            {!isConfirmed && (
              <button
                onClick={handleRegenerate}
                className="w-full py-2.5 border border-dashed border-gray-300 rounded-xl text-sm text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors"
              >
                ↺ Regenerate all meals
              </button>
            )}
          </>
        )}
        {showUnlockDialog && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-xl">
              <h2 className="text-lg font-bold text-gray-900">Unlock this week?</h2>
              <p className="text-sm text-gray-500">
                This will re-open the plan for editing. Your grocery list will remain available but
                the plan will return to draft status.
              </p>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowUnlockDialog(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:border-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUnlock}
                  disabled={unlocking}
                  className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors"
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
