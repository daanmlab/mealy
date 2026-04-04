'use client';

import { useEffect, useState } from 'react';
import { recipesApi } from '@/lib/api';
import type { Recipe, RecipeTag, Plan, PlanMeal } from '@/lib/api';

interface SwapPickerModalProps {
  plan: Plan;
  meal: PlanMeal;
  onSwap: (recipeId: string) => Promise<void>;
  onClose: () => void;
}

const TAG_OPTIONS: { label: string; value: RecipeTag | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: '⚡ Quick', value: 'quick' },
  { label: '🥗 Healthy', value: 'healthy' },
  { label: '🌿 Vegetarian', value: 'vegetarian' },
  { label: '💪 Protein', value: 'high_protein' },
  { label: '💰 Budget', value: 'cheap' },
  { label: '🍝 Pasta', value: 'pasta' },
  { label: '🥣 Bowl', value: 'bowl' },
  { label: '🍲 Soup', value: 'soup' },
  
];

function RecipeRow({ recipe, onSwap }: { recipe: Recipe; onSwap: (id: string) => Promise<void> }) {
  return (
    <button
      key={recipe.id}
      onClick={() => onSwap(recipe.id)}
      className="w-full flex items-center gap-3 px-0 py-3 border-b border-gray-50 last:border-0 text-left hover:bg-gray-50 rounded-lg transition-colors -mx-1 px-1"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm truncate">{recipe.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400">⏱ {recipe.cookTimeMinutes} min</span>
          {recipe.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 capitalize">
              {t.replace('_', '-')}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

export default function SwapPickerModal({ plan, meal, onSwap, onClose }: SwapPickerModalProps) {
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<RecipeTag | 'all'>('all');

  useEffect(() => {
    recipesApi.list().then(setAllRecipes);
  }, []);

  const loading = allRecipes.length === 0;

  const planRecipeIds = new Set(plan.meals.map((m) => m.recipe.id));
  const suggestions = allRecipes.filter((r) => !planRecipeIds.has(r.id)).slice(0, 5);

  const isFiltering = search.trim() !== '' || activeTag !== 'all';

  const filtered = allRecipes
    .filter((r) => {
      const matchesSearch = search.trim() === '' || r.title.toLowerCase().includes(search.trim().toLowerCase());
      const matchesTag = activeTag === 'all' || r.tags.includes(activeTag as RecipeTag);
      return matchesSearch && matchesTag;
    })
    .slice(0, 50);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Choose a recipe</h2>
            <p className="text-xs text-gray-400 mt-0.5 capitalize">
              Replacing: {meal.day} — {meal.recipe.title}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 -mr-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-4 pb-4">
          {loading ? (
            <>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse mb-2" />
              ))}
            </>
          ) : (
            <>
              {!isFiltering && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-4 mb-2">Suggestions</p>
                  {suggestions.map((recipe) => (
                    <RecipeRow key={recipe.id} recipe={recipe} onSwap={onSwap} />
                  ))}
                  <div className="border-t border-gray-100 my-4" />
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Browse all</p>
                </>
              )}

              <input
                placeholder="Search recipes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm mb-3 mt-2"
              />

              {/* Tag strip */}
              <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
                {TAG_OPTIONS.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => setActiveTag(value)}
                    className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      activeTag === value
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {filtered.map((recipe) => (
                <RecipeRow key={recipe.id} recipe={recipe} onSwap={onSwap} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
