'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { recipesApi, favoritesApi, type Recipe } from '@/lib/api';

export default function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    recipesApi.get(id).then((r) => { setRecipe(r); setLoading(false); });
    favoritesApi.list().then((favs) => setIsFavorite(favs.some((f) => f.recipeId === id)));
  }, [id]);

  async function toggleFavorite() {
    if (isFavorite) {
      await favoritesApi.remove(id);
      setIsFavorite(false);
    } else {
      await favoritesApi.add(id);
      setIsFavorite(true);
    }
  }

  if (loading) return (
    <div className="space-y-4">
      <div className="h-6 w-48 bg-gray-100 rounded animate-pulse" />
      <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
    </div>
  );

  if (!recipe) return null;

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1"
      >
        ← Back
      </button>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{recipe.title}</h1>
              <p className="text-gray-500 text-sm mt-1">{recipe.description}</p>
            </div>
            <button
              onClick={toggleFavorite}
              className={`p-2.5 rounded-xl border transition-colors ${
                isFavorite ? 'border-red-200 bg-red-50 text-red-500' : 'border-gray-200 text-gray-300 hover:text-gray-500'
              }`}
            >
              ♥
            </button>
          </div>

          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <span>⏱</span>
              <span>{recipe.cookTimeMinutes} min</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <span>👤</span>
              <span>{recipe.servings} servings</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {recipe.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full capitalize">
                {tag.replace('_', '-')}
              </span>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-50 p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Ingredients</h2>
          <ul className="space-y-2">
            {recipe.ingredients.map((ri) => (
              <li key={ri.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 capitalize">{ri.ingredient.name}</span>
                <span className="text-gray-400">
                  {ri.amount % 1 === 0 ? ri.amount : ri.amount.toFixed(1)} {ri.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-gray-50 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Instructions</h2>
          <ol className="space-y-4">
            {recipe.steps
              .sort((a, b) => a.order - b.order)
              .map((step) => (
                <li key={step.order} className="flex gap-4">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex-shrink-0 flex items-center justify-center">
                    {step.order}
                  </span>
                  <p className="text-sm text-gray-700 leading-relaxed pt-0.5">{step.text}</p>
                </li>
              ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
