'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth';
import { adminApi, type AuditLogEntry } from '@/lib/api';

const PAGE_SIZE = 50;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'short',
    timeStyle: 'medium',
  });
}

export default function AdminAuditPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (!user.isAdmin) { router.replace('/plan'); return; }
  }, [loading, user, router]);

  const loadPage = useCallback((p: number) => {
    if (!user?.isAdmin) return;
    setFetching(true);
    adminApi
      .getAuditLogs(p, PAGE_SIZE)
      .then((data) => {
        setLogs(data.items);
        setTotal(data.total);
        setPage(p);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load audit logs'))
      .finally(() => setFetching(false));
  }, [user?.isAdmin]);

  useEffect(() => { loadPage(1); }, [loadPage]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading || !user || !user.isAdmin) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total entries</p>
        </div>
      </div>

      {fetching && <p className="text-sm text-gray-400">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!fetching && logs.length === 0 && (
        <p className="text-sm text-gray-400">No audit log entries yet.</p>
      )}

      {logs.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">Entity</th>
                  <th className="px-4 py-3 text-left">Entity ID</th>
                  <th className="px-4 py-3 text-left">Actor ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap text-xs">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
                      {log.action}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{log.entityType}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-400 max-w-[120px] truncate">
                      {log.entityId}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-400 max-w-[120px] truncate">
                      {log.actorId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Page {page} of {totalPages} ({total} entries)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => loadPage(page - 1)}
                  disabled={page <= 1 || fetching}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => loadPage(page + 1)}
                  disabled={page >= totalPages || fetching}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
