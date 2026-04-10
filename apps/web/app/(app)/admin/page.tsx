'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import { adminApi, type AdminRecipeListItem } from '@/lib/api';
import { RecipeTable } from './components/RecipeTable';
import { UrlImportPanel } from './components/UrlImportPanel';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [recipes, setRecipes] = useState<AdminRecipeListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'url' | 'manual'>('url');

  const reloadRecipes = useCallback(() => {
    if (!user?.isAdmin) return;
    adminApi
      .listRecipes()
      .then((data) => {
        setRecipes(data.items);
        setTotal(data.total);
      })
      .catch((e) => setFetchError(e instanceof Error ? e.message : 'Failed to load recipes'))
      .finally(() => setFetching(false));
  }, [user?.isAdmin]);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (!user.isAdmin) { router.replace('/plan'); return; }
  }, [loading, user, router]);

  useEffect(() => { reloadRecipes(); }, [reloadRecipes]);

  if (loading || !user || !user.isAdmin) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
        <p className="text-sm text-gray-500 mt-1">Manage recipes and import new ones.</p>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Add Recipe</h2>
        <div className="flex gap-2 border-b border-gray-100 pb-3">
          {(['url', 'manual'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {tab === 'url' ? '🔗 Import from URL' : '✏️ Manual form'}
            </button>
          ))}
        </div>

        {activeTab === 'url' && <UrlImportPanel onImported={reloadRecipes} />}
        {activeTab === 'manual' && (
          <p className="text-sm text-gray-500 italic">
            Manual recipe creation form coming soon.
          </p>
        )}
      </section>

      <section>
        {fetching && (
          <p className="text-sm text-gray-400">Loading recipes…</p>
        )}
        {fetchError && (
          <p className="text-sm text-red-600">{fetchError}</p>
        )}
        {!fetching && !fetchError && (
          <RecipeTable initialRecipes={recipes} total={total} />
        )}
      </section>
    </div>
  );
}
