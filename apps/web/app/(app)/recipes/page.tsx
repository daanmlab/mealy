'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { recipesApi, favoritesApi, type Recipe, type RecipeTag } from '@/lib/api';

const TAG_FILTERS: { value: RecipeTag | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'quick', label: '⚡ Quick' },
  { value: 'healthy', label: '🥗 Healthy' },
  { value: 'vegetarian', label: '🌿 Vegetarian' },
  { value: 'high_protein', label: '💪 Protein' },
  { value: 'cheap', label: '💰 Budget' },
  { value: 'pasta', label: '🍝 Pasta' },
  { value: 'bowl', label: '🥣 Bowl' },
  { value: 'soup', label: '🍲 Soup' },
];

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [activeTag, setActiveTag] = useState<RecipeTag | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    favoritesApi.list()
      .then((favs) => setFavorites(new Set(favs.map((f) => f.recipeId))))
      .catch(() => {/* non-critical: favorites can fail silently */});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = activeTag !== 'all' ? { tags: [activeTag] } : undefined;
    recipesApi.list(params)
      .then((r) => { setRecipes(r); setLoading(false); })
      .catch(() => { setError('Failed to load recipes. Please try again.'); setLoading(false); });
  }, [activeTag]);

  async function toggleFavorite(e: React.MouseEvent, recipeId: string) {
    e.preventDefault();
    try {
      if (favorites.has(recipeId)) {
        await favoritesApi.remove(recipeId);
        setFavorites((f) => { const n = new Set(f); n.delete(recipeId); return n; });
      } else {
        await favoritesApi.add(recipeId);
        setFavorites((f) => new Set(f).add(recipeId));
      }
    } catch {
      // Optimistic update already skipped; no UI change needed
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">Recipes</h1>

      {/* Tag filter strip */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-4 px-4 scrollbar-none">
        {TAG_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveTag(value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeTag === value
                ? 'bg-green-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-green-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <p className="text-red-500 text-sm text-center py-12">{error}</p>
      ) : recipes.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-12">No recipes found.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {recipes.map((recipe) => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="bg-white rounded-xl border border-gray-100 p-4 hover:border-green-200 hover:shadow-sm transition-all block"
            >
              <div className="flex justify-between items-start gap-2">
                <h3 className="font-medium text-gray-900 text-sm leading-snug flex-1">{recipe.title}</h3>
                <button
                  onClick={(e) => toggleFavorite(e, recipe.id)}
                  className={`text-base shrink-0 transition-colors ${
                    favorites.has(recipe.id) ? 'text-red-500' : 'text-gray-200 hover:text-gray-400'
                  }`}
                >
                  ♥
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2 line-clamp-2">{recipe.description}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-400">⏱ {recipe.cookTimeMinutes} min</span>
                <div className="flex gap-1">
                  {recipe.tags.slice(0, 2).map((t) => (
                    <span key={t.tag.slug} className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded capitalize font-medium">
                      {t.tag.slug.replaceAll('_', '-')}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
