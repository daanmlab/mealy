'use client';

import { useEffect, useState } from 'react';
import { favoritesApi, type FavoriteRecipe } from '@/lib/api';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    favoritesApi.list().then((data) => { setFavorites(data); setLoading(false); });
  }, []);

  async function handleRemove(recipeId: string) {
    await favoritesApi.remove(recipeId);
    setFavorites((f) => f.filter((x) => x.recipeId !== recipeId));
  }

  if (loading) return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  );

  if (favorites.length === 0) return (
    <div className="text-center py-16">
      <p className="text-4xl mb-4">♥</p>
      <h2 className="text-lg font-semibold text-gray-900">No favorites yet</h2>
      <p className="text-sm text-gray-500 mt-1">Heart a meal in your weekly plan to save it here.</p>
    </div>
  );

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Saved meals</h1>
      <div className="space-y-3">
        {favorites.map(({ recipe, recipeId }) => (
          <div key={recipeId} className="bg-white rounded-xl border border-gray-100 p-4 flex gap-4 items-center">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{recipe.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">⏱ {recipe.cookTimeMinutes} min</p>
            </div>
            <button
              onClick={() => handleRemove(recipeId)}
              className="p-2 text-red-400 hover:text-red-600 transition-colors"
              title="Remove from favorites"
            >
              ♥
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
