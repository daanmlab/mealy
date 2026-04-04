'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/auth';
import { usersApi, type FoodGoal, type CookTimePreference } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useWeekStartDay } from '@/hooks/useWeekStartDay';

const GOALS: { value: FoodGoal; label: string }[] = [
  { value: 'healthy', label: 'Healthy' },
  { value: 'easy', label: 'Quick & easy' },
  { value: 'cheap', label: 'Budget' },
  { value: 'high_protein', label: 'High-protein' },
];
const COOK_TIMES: { value: CookTimePreference; label: string }[] = [
  { value: 'under20', label: '< 20 min' },
  { value: 'under40', label: '< 40 min' },
  { value: 'any', label: 'Any' },
];
const DISLIKES_OPTIONS = ['pork', 'shellfish', 'gluten', 'dairy', 'nuts', 'eggs', 'fish'];

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const { weekStartsOn, setWeekStartsOn } = useWeekStartDay();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [peopleCount, setPeopleCount] = useState(user?.peopleCount ?? 2);
  const [mealsPerWeek, setMealsPerWeek] = useState(user?.mealsPerWeek ?? 5);
  const [cookTime, setCookTime] = useState<CookTimePreference>(user?.cookTime ?? 'under40');
  const [goal, setGoal] = useState<FoodGoal>(user?.goal ?? 'healthy');
  const [dislikes, setDislikes] = useState<string[]>(user?.dislikes ?? []);

  function toggleDislike(item: string) {
    setDislikes((prev) => (prev.includes(item) ? prev.filter((d) => d !== item) : [...prev, item]));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await usersApi.updatePreferences({ peopleCount, mealsPerWeek, cookTime, goal, dislikes });
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-gray-900">Settings</h1>

      <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
        <h2 className="font-semibold text-gray-900">Account</h2>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">
            {user.name?.[0]?.toUpperCase() ?? user.email[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="font-medium text-gray-900">{user.name ?? '—'}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Preferences</h2>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">People cooking for</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setPeopleCount(n)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  peopleCount === n ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'
                }`}
              >
                {n === 4 ? '4+' : n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Dinners per week</label>
          <div className="flex gap-2">
            {[3, 4, 5, 7].map((n) => (
              <button
                key={n}
                onClick={() => setMealsPerWeek(n)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  mealsPerWeek === n ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Meal goal</label>
          <div className="flex flex-wrap gap-2">
            {GOALS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setGoal(value)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  goal === value ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Cook time</label>
          <div className="flex gap-2">
            {COOK_TIMES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setCookTime(value)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  cookTime === value ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Week starts on</label>
          <div className="flex gap-2">
            {([1, 0] as const).map((day) => (
              <button
                key={day}
                onClick={() => setWeekStartsOn(day)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  weekStartsOn === day ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'
                }`}
              >
                {day === 1 ? 'Monday' : 'Sunday'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Ingredients to avoid</label>
          <div className="flex flex-wrap gap-2">
            {DISLIKES_OPTIONS.map((item) => (
              <button
                key={item}
                onClick={() => toggleDislike(item)}
                className={`px-3 py-1.5 rounded-full border text-sm font-medium capitalize transition-colors ${
                  dislikes.includes(item) ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save changes'}
        </button>
      </section>

      <section className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Account actions</h2>
        <button
          onClick={() => logout().then(() => router.push('/login'))}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Sign out
        </button>
      </section>
    </div>
  );
}
