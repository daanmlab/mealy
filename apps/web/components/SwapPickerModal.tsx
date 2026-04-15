'use client';

import { useEffect, useState } from 'react';
import { X, Clock, Search } from 'lucide-react';
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
  { label: 'Quick', value: 'quick' },
  { label: 'Healthy', value: 'healthy' },
  { label: 'Vegetarian', value: 'vegetarian' },
  { label: 'Protein', value: 'high_protein' },
  { label: 'Budget', value: 'cheap' },
  { label: 'Pasta', value: 'pasta' },
  { label: 'Bowl', value: 'bowl' },
  { label: 'Soup', value: 'soup' },
];

function RecipeRow({ recipe, onSwap }: { recipe: Recipe; onSwap: (id: string) => Promise<void> }) {
  return (
    <button
      key={recipe.id}
      onClick={() => onSwap(recipe.id)}
      className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-surface-container rounded-xl transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-on-surface text-sm truncate">{recipe.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-on-surface-variant flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {recipe.cookTimeMinutes} min
          </span>
          {recipe.tags.slice(0, 3).map((t) => (
            <span
              key={t.tag.slug}
              className="text-xs px-2 py-0.5 bg-surface-container rounded-full text-on-surface-variant capitalize"
            >
              {t.tag.slug.replace('_', '-')}
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
      const matchesSearch =
        search.trim() === '' || r.title.toLowerCase().includes(search.trim().toLowerCase());
      const matchesTag = activeTag === 'all' || r.tags.some((rt) => rt.tag.slug === activeTag);
      return matchesSearch && matchesTag;
    })
    .slice(0, 50);

  return (
    <div className="fixed inset-0 bg-on-surface/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col shadow-[0_12px_32px_rgba(28,28,24,0.08)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-outline-variant/20">
          <div>
            <h2 className="text-lg font-bold text-primary font-headline">Choose a recipe</h2>
            <p className="text-sm text-on-surface-variant mt-0.5 capitalize">
              Replacing: {meal.day} — {meal.recipe.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors p-2 -mr-2 rounded-lg hover:bg-surface-container"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-6 pb-6">
          {loading ? (
            <>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 bg-surface-container rounded-xl animate-pulse mb-2" />
              ))}
            </>
          ) : (
            <>
              {!isFiltering && (
                <>
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mt-6 mb-3">
                    Suggestions
                  </p>
                  {suggestions.map((recipe) => (
                    <RecipeRow key={recipe.id} recipe={recipe} onSwap={onSwap} />
                  ))}
                  <div className="border-t border-outline-variant/20 my-4" />
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">
                    Browse all
                  </p>
                </>
              )}

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input
                  placeholder="Search recipes…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low rounded-xl text-sm focus-glow border border-transparent"
                />
              </div>

              {/* Tag strip */}
              <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
                {TAG_OPTIONS.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => setActiveTag(value)}
                    className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      activeTag === value
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/20 hover:border-outline'
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
