'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import { usersApi, type FoodGoal, type CookTimePreference } from '@/lib/api';

const GOALS: { value: FoodGoal; label: string; desc: string }[] = [
  { value: 'healthy', label: '🥗 Healthy', desc: 'Balanced, nutritious meals' },
  { value: 'easy', label: '⚡ Quick & easy', desc: 'Fast weeknight dinners' },
  { value: 'cheap', label: '💰 Budget', desc: 'Affordable ingredients' },
  { value: 'high_protein', label: '💪 High-protein', desc: 'Protein-rich meals' },
];

const COOK_TIMES: { value: CookTimePreference; label: string }[] = [
  { value: 'under20', label: '< 20 min' },
  { value: 'under40', label: '< 40 min' },
  { value: 'any', label: 'Any time' },
];

const DISLIKES_OPTIONS = ['pork', 'shellfish', 'gluten', 'dairy', 'nuts', 'eggs', 'fish'];

export default function OnboardingPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [peopleCount, setPeopleCount] = useState(user?.peopleCount ?? 2);
  const [mealsPerWeek, setMealsPerWeek] = useState(user?.mealsPerWeek ?? 5);
  const [cookTime, setCookTime] = useState<CookTimePreference>(user?.cookTime ?? 'under40');
  const [goal, setGoal] = useState<FoodGoal>(user?.goal ?? 'healthy');
  const [dislikes, setDislikes] = useState<string[]>(user?.dislikes ?? []);
  const [saving, setSaving] = useState(false);

  function toggleDislike(item: string) {
    setDislikes((prev) => (prev.includes(item) ? prev.filter((d) => d !== item) : [...prev, item]));
  }

  async function finish() {
    setSaving(true);
    try {
      await usersApi.updatePreferences({
        peopleCount,
        mealsPerWeek,
        cookTime,
        goal,
        dislikes,
        onboardingDone: true,
      });
      await refreshUser();
      router.push('/plan');
    } finally {
      setSaving(false);
    }
  }

  const steps = [
    // Step 0 — household
    <div key="household" className="space-y-6">
      <h2 className="text-xl font-semibold">How many people are you cooking for?</h2>
      <div className="flex gap-3">
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => setPeopleCount(n)}
            className={`flex-1 py-3 rounded-xl border-2 font-semibold transition-colors ${
              peopleCount === n
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {n === 4 ? '4+' : n}
          </button>
        ))}
      </div>
      <h2 className="text-xl font-semibold">How many dinners per week?</h2>
      <div className="flex gap-3">
        {[3, 4, 5, 7].map((n) => (
          <button
            key={n}
            onClick={() => setMealsPerWeek(n)}
            className={`flex-1 py-3 rounded-xl border-2 font-semibold transition-colors ${
              mealsPerWeek === n
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>,

    // Step 1 — goal + cook time
    <div key="goal" className="space-y-6">
      <h2 className="text-xl font-semibold">What's your meal goal?</h2>
      <div className="grid grid-cols-2 gap-3">
        {GOALS.map(({ value, label, desc }) => (
          <button
            key={value}
            onClick={() => setGoal(value)}
            className={`p-4 rounded-xl border-2 text-left transition-colors ${
              goal === value
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold text-sm">{label}</div>
            <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
          </button>
        ))}
      </div>
      <h2 className="text-xl font-semibold">How much time do you have?</h2>
      <div className="flex gap-3">
        {COOK_TIMES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setCookTime(value)}
            className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
              cookTime === value
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>,

    // Step 2 — dislikes
    <div key="dislikes" className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Any ingredients to avoid?</h2>
        <p className="text-sm text-gray-500 mt-1">Optional — you can skip this</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {DISLIKES_OPTIONS.map((item) => (
          <button
            key={item}
            onClick={() => toggleDislike(item)}
            className={`px-4 py-2 rounded-full border-2 text-sm font-medium capitalize transition-colors ${
              dislikes.includes(item)
                ? 'border-red-400 bg-red-50 text-red-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>,
  ];

  return (
    <div className="h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-medium">
              Step {step + 1} of {steps.length}
            </span>
            <span className="text-green-600 font-bold text-lg">mealy</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {steps[step]}

        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
          )}
          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={saving}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : "Let's go →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
