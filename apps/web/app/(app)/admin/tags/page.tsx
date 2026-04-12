'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import { adminApi, type Tag } from '@/lib/api';

export default function AdminTagsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<Record<string, string>>({});

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (!user.isAdmin) { router.replace('/plan'); return; }
  }, [loading, user, router]);

  const loadTags = useCallback(() => {
    if (!user?.isAdmin) return;
    adminApi
      .getTags()
      .then(setTags)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load tags'))
      .finally(() => setFetching(false));
  }, [user?.isAdmin]);

  useEffect(() => { loadTags(); }, [loadTags]);

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditValue(tag.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveRename = async (id: string) => {
    if (!editValue.trim()) return;
    setSaving(id);
    try {
      await adminApi.renameTag(id, editValue.trim());
      setTags((prev) => prev.map((t) => (t.id === id ? { ...t, name: editValue.trim() } : t)));
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename tag');
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete tag "${name}"? This cannot be undone.`)) return;
    setDeleteError((prev) => ({ ...prev, [id]: '' }));
    try {
      await adminApi.deleteTag(id);
      setTags((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      setDeleteError((prev) => ({
        ...prev,
        [id]: e instanceof Error ? e.message : 'Failed to delete',
      }));
    }
  };

  if (loading || !user || !user.isAdmin) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 max-w-2xl">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tag Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{tags.length} tags</p>
        </div>
      </div>

      {fetching && <p className="text-sm text-gray-400">Loading tags…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!fetching && tags.length === 0 && (
        <p className="text-sm text-gray-400">No tags found.</p>
      )}

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {tags.map((tag) => (
          <div key={tag.id} className="flex items-center gap-3 px-4 py-3">
            <span className="text-xs font-mono text-gray-400 w-32 shrink-0 truncate">{tag.slug}</span>
            {editingId === tag.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveRename(tag.id);
                    if (e.key === 'Escape') cancelEdit();
                  }}
                  autoFocus
                  className="flex-1 px-2.5 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button
                  onClick={() => void saveRename(tag.id)}
                  disabled={saving === tag.id || !editValue.trim()}
                  className="px-3 py-1 text-sm font-medium bg-gray-900 text-white rounded-lg disabled:opacity-50"
                >
                  {saving === tag.id ? '…' : 'Save'}
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-3 py-1 text-sm text-gray-500 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <span className="flex-1 text-sm text-gray-800">{tag.name}</span>
            )}
            {editingId !== tag.id && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => startEdit(tag)}
                  className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  Rename
                </button>
                <button
                  onClick={() => void handleDelete(tag.id, tag.name)}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            )}
            {deleteError[tag.id] && (
              <p className="text-xs text-red-500 mt-1">{deleteError[tag.id]}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
