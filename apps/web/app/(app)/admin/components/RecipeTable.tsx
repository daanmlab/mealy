'use client';

import { useState, useTransition } from 'react';
import type { AdminRecipeListItem, Recipe } from '@/lib/api';
import { adminApi } from '@/lib/api';
import { toggleRecipeActive, deleteRecipe } from '../actions';
import { RecipeDetailModal } from './RecipeDetailModal';

interface RecipeTableProps {
  initialRecipes: AdminRecipeListItem[];
  total: number;
}

export function RecipeTable({ initialRecipes, total }: RecipeTableProps) {
  const [recipes, setRecipes] = useState(initialRecipes);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const openRecipe = (id: string) => {
    adminApi.getRecipe(id).then(setSelectedRecipe).catch(() => null);
  };

  const handleToggle = (id: string, current: boolean) => {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      try {
        await toggleRecipeActive(id, !current);
        setRecipes((prev) =>
          prev.map((r) => (r.id === id ? { ...r, isActive: !current } : r)),
        );
        // Keep modal in sync if it's open
        setSelectedRecipe((prev) => prev?.id === id ? { ...prev, isActive: !current } : prev);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update recipe');
      } finally {
        setBusyId(null);
      }
    });
  };

  const handleDelete = (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      try {
        await deleteRecipe(id);
        setRecipes((prev) => prev.filter((r) => r.id !== id));
        setSelectedRecipe((prev) => prev?.id === id ? null : prev);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete recipe');
      } finally {
        setBusyId(null);
      }
    });
  };

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">All Recipes ({total})</h2>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Tags</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Cook time</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recipes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No recipes yet
                  </td>
                </tr>
              )}
              {recipes.map((recipe) => {
                const busy = busyId === recipe.id && isPending;
                return (
                  <tr
                    key={recipe.id}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${busy ? 'opacity-50' : ''}`}
                  >
                    <td
                      className="px-4 py-3 font-medium text-gray-900"
                      onClick={() => openRecipe(recipe.id)}
                    >
                      {recipe.title}
                      <span className="ml-1.5 text-xs text-gray-400 font-normal">
                        ({recipe._count.ingredients} ing.)
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 hidden md:table-cell"
                      onClick={() => openRecipe(recipe.id)}
                    >
                      <div className="flex flex-wrap gap-1">
                        {recipe.tags.map(({ tag }) => (
                          <span
                            key={tag.id}
                            className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td
                      className="px-4 py-3 text-gray-500 hidden sm:table-cell"
                      onClick={() => openRecipe(recipe.id)}
                    >
                      {recipe.cookTimeMinutes} min
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggle(recipe.id, recipe.isActive); }}
                        disabled={busy}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          recipe.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${recipe.isActive ? 'bg-green-500' : 'bg-gray-400'}`}
                        />
                        {recipe.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(recipe.id, recipe.title); }}
                        disabled={busy}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <RecipeDetailModal recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} />
    </>
  );
}
