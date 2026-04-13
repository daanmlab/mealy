'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import { adminApi } from '@/lib/api';
import type { Recipe, Unit, IngredientCategory, Tag } from '@/lib/api';
import { RecipeEditForm } from '../../../components/RecipeEditForm';

export default function RecipeEditPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<IngredientCategory[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (!user.isAdmin) { router.replace('/plan'); return; }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user?.isAdmin) return;
    Promise.all([adminApi.getRecipe(id), adminApi.getUnits(), adminApi.getIngredientCategories(), adminApi.getTags()])
      .then(([r, u, c, t]) => {
        setRecipe(r);
        setUnits(u);
        setCategories(c);
        setAllTags(t);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load recipe'))
      .finally(() => setFetching(false));
  }, [id, user?.isAdmin]);

  if (loading || !user || !user.isAdmin) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  if (fetching) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading recipe…</p>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">{error ?? 'Recipe not found'}</p>
        <button
          onClick={() => router.push('/admin')}
          className="text-sm text-gray-500 hover:text-gray-900 underline"
        >
          ← Back to admin
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/admin')}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          ← Admin
        </button>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900 truncate">{recipe.title}</h1>
      </div>

      <RecipeEditForm
        recipe={recipe}
        units={units}
        categories={categories}
        allTags={allTags}
        onSaved={(updated) => {
          setRecipe(updated);
          router.push('/admin');
        }}
        onCancel={() => router.push('/admin')}
      />
    </div>
  );
}
