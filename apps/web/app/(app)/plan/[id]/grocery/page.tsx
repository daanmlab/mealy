'use client';

import { useEffect, useState, useCallback } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { groceryApi, type GroceryList, type GroceryItem } from '@/lib/api';

const CATEGORY_LABELS: Record<string, string> = {
  produce: '🥦 Produce',
  meat: '🥩 Meat',
  seafood: '🐟 Seafood',
  dairy: '🧀 Dairy',
  grains: '🌾 Grains & Pasta',
  canned: '🥫 Canned & Pantry',
  condiments: '🫙 Condiments',
  spices: '🌿 Spices',
  frozen: '🧊 Frozen',
  other: '📦 Other',
};

export default function GroceryListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: planId } = use(params);
  const router = useRouter();
  const [list, setList] = useState<GroceryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await groceryApi.get(planId);
      setList(data);
    } catch {
      // List doesn't exist yet
      setList(null);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const data = await groceryApi.generate(planId);
      setList(data);
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggle(item: GroceryItem) {
    if (!list) return;
    const updated = await groceryApi.toggle(planId, item.id);
    setList((l) =>
      l ? { ...l, items: l.items.map((i) => (i.id === item.id ? updated : i)) } : l,
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!list) {
    return (
      <div className="text-center py-16">
        <p className="text-4xl mb-4">🛒</p>
        <h2 className="text-lg font-semibold text-gray-900">No grocery list yet</h2>
        <p className="text-sm text-gray-500 mt-1 mb-6">Generate a list from your confirmed plan.</p>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {generating ? 'Generating…' : 'Generate grocery list'}
        </button>
      </div>
    );
  }

  // Group items by category slug, then by ingredientId within each category
  const grouped = list.items.reduce<Record<string, GroceryItem[]>>((acc, item) => {
    const cat = item.ingredient.category?.slug ?? 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  // Within each category group items with the same ingredientId into one visual row
  type IngredientGroup = { items: GroceryItem[] };
  const groupedByIngredient = Object.fromEntries(
    Object.entries(grouped).map(([cat, items]) => {
      const byIngredient = new Map<string, IngredientGroup>();
      for (const item of items) {
        const ing = item.ingredient.id;
        if (!byIngredient.has(ing)) byIngredient.set(ing, { items: [] });
        byIngredient.get(ing)!.items.push(item);
      }
      return [cat, [...byIngredient.values()]];
    }),
  );

  const checkedCount = list.items.filter((i) => i.isChecked).length;
  const total = list.items.length;

  function formatAmount(amount: number): string {
    return amount % 1 === 0 ? String(amount) : amount.toFixed(1);
  }

  function formatMeasurement(item: GroceryItem): string {
    return item.unit ? `${formatAmount(item.totalAmount)} ${item.unit.symbol}` : formatAmount(item.totalAmount);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => router.push('/plan')}
            className="text-sm text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1"
          >
            ← Back to plan
          </button>
          <h1 className="text-xl font-bold text-gray-900">Grocery list</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {checkedCount}/{total} items checked
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-3 py-1.5 border border-gray-200 text-sm text-gray-500 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {generating ? '…' : 'Regenerate'}
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full mb-6">
        <div
          className="h-full bg-green-500 rounded-full transition-all"
          style={{ width: total ? `${(checkedCount / total) * 100}%` : '0%' }}
        />
      </div>

      <div className="space-y-6">
        {Object.entries(groupedByIngredient)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([category, ingredientGroups]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                {CATEGORY_LABELS[category] ?? category}
              </h3>
              <div className="space-y-1">
                {ingredientGroups.map(({ items: subItems }) => {
                  const allChecked = subItems.every((i) => i.isChecked);
                  const anyChecked = subItems.some((i) => i.isChecked);
                  // Sort: real-unit entries first, null-unit (count) entries last
                  const sorted = [...subItems].sort((a, b) =>
                    a.unit && !b.unit ? -1 : !a.unit && b.unit ? 1 : 0,
                  );
                  const measurement = sorted.map(formatMeasurement).join(' + ');
                  const firstItem = subItems[0]!;

                  return (
                    <button
                      key={firstItem.ingredient.id}
                      onClick={async () => {
                        // If all checked → uncheck all; otherwise check all
                        const targets = allChecked
                          ? subItems
                          : subItems.filter((i) => !i.isChecked);
                        for (const item of targets) await handleToggle(item);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                        allChecked ? 'bg-gray-50' : 'bg-white border border-gray-100'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                          allChecked
                            ? 'border-green-500 bg-green-500'
                            : anyChecked
                              ? 'border-green-300 bg-green-100'
                              : 'border-gray-300'
                        }`}
                      >
                        {allChecked && (
                          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span
                        className={`flex-1 text-sm font-medium capitalize ${
                          allChecked ? 'line-through text-gray-400' : 'text-gray-800'
                        }`}
                      >
                        {firstItem.ingredient.name}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {measurement}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
