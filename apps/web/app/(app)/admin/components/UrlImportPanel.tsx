'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { getAccessToken } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type StepName = 'fetch' | 'extract' | 'verify' | 'group' | 'normalize' | 'canonicalize' | 'save';
type StepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'error';
type JobStatus = 'queued' | 'running' | 'done' | 'error';

interface Step {
  name: StepName;
  label: string;
  status: StepStatus;
  message: string;
}

interface ImportJob {
  jobId: string;
  url: string;
  status: JobStatus;
  steps: Step[];
  result?: { id: string; title: string };
  startedAt: Date;
  expanded: boolean;
}

const STEP_DEFS: { name: StepName; label: string }[] = [
  { name: 'fetch',        label: 'Fetch page' },
  { name: 'extract',      label: 'Extract recipe data' },
  { name: 'verify',       label: 'Verify & fix quality' },
  { name: 'group',        label: 'Group ingredients' },
  { name: 'normalize',    label: 'Normalize' },
  { name: 'canonicalize', label: 'Canonicalize' },
  { name: 'save',         label: 'Save recipe' },
];

function makeInitialSteps(): Step[] {
  return STEP_DEFS.map(({ name, label }) => ({ name, label, status: 'pending', message: '' }));
}

function elapsed(from: Date): string {
  const s = Math.floor((Date.now() - from.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ${s % 60}s ago`;
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'pending')
    return <span className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0 inline-block" />;
  if (status === 'running')
    return (
      <svg className="w-4 h-4 animate-spin text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    );
  if (status === 'done')
    return (
      <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  if (status === 'skipped')
    return (
      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
      </svg>
    );
  return (
    <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function JobStatusIcon({ status }: { status: JobStatus }) {
  if (status === 'queued' || status === 'running')
    return (
      <svg
        className={`w-4 h-4 shrink-0 ${status === 'running' ? 'animate-spin text-blue-500' : 'text-gray-400'}`}
        fill="none" viewBox="0 0 24 24"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    );
  if (status === 'done')
    return (
      <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  return (
    <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function JobRow({
  job,
  onToggle,
  onTick,
}: {
  job: ImportJob;
  onToggle: () => void;
  onTick: () => void;
}) {
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (job.status === 'running' || job.status === 'queued') {
      tickRef.current = setInterval(onTick, 1000);
    } else {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.status]);

  const shortUrl = (() => {
    try {
      const u = new URL(job.url);
      return u.hostname + u.pathname.replace(/\/$/, '');
    } catch {
      return job.url;
    }
  })();

  return (
    <div
      className={`border rounded-lg overflow-hidden text-sm ${
        job.status === 'error'   ? 'border-red-200'  :
        job.status === 'done'    ? 'border-green-200' :
        job.status === 'running' ? 'border-blue-200'  :
        'border-gray-200'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:brightness-95 transition-all ${
          job.status === 'error'   ? 'bg-red-50'   :
          job.status === 'done'    ? 'bg-green-50'  :
          job.status === 'running' ? 'bg-blue-50'   :
          'bg-gray-50'
        }`}
      >
        <JobStatusIcon status={job.status} />
        <span className="flex-1 font-mono text-xs text-gray-700 truncate min-w-0">{shortUrl}</span>
        {job.status === 'done' && job.result && (
          <span className="shrink-0 text-xs text-green-700 font-medium max-w-[160px] truncate">
            &ldquo;{job.result.title}&rdquo;
          </span>
        )}
        {job.status === 'error' && (
          <span className="shrink-0 text-xs text-red-600 font-medium">Failed</span>
        )}
        <span className="shrink-0 text-xs text-gray-400">{elapsed(job.startedAt)}</span>
        <svg
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${job.expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {job.expanded && (
        <div className="border-t border-gray-100 font-mono divide-y divide-gray-100">
          {job.steps.map((step) => (
            <div
              key={step.name}
              className={`flex items-center gap-3 px-4 py-2 ${
                step.status === 'running' ? 'bg-blue-50' :
                step.status === 'error'   ? 'bg-red-50'  :
                step.status === 'skipped' ? 'opacity-40' : ''
              }`}
            >
              <StepIcon status={step.status} />
              <span
                className={`text-xs font-medium ${
                  step.status === 'error' ? 'text-red-700' :
                  step.status === 'done'  ? 'text-gray-800' : 'text-gray-500'
                }`}
              >
                {step.label}
              </span>
              {step.message && (
                <span className="ml-auto text-xs text-gray-400 truncate max-w-[50%]">{step.message}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const STORAGE_KEY = 'mealy-import-jobs';

type StoredJob = Omit<ImportJob, 'startedAt'> & { startedAt: string };

function deserializeJobs(raw: string): ImportJob[] {
  const parsed = JSON.parse(raw) as StoredJob[];
  return parsed.map((j) => ({ ...j, startedAt: new Date(j.startedAt) }));
}

export function UrlImportPanel({ onImported }: { onImported?: () => void }) {
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [, setTick] = useState(0);
  const onImportedRef = useRef(onImported);
  useEffect(() => { onImportedRef.current = onImported; }, [onImported]);

  useEffect(() => {
    if (jobs.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  }, [jobs]);

  const updateJob = useCallback((jobId: string, updater: (job: ImportJob) => ImportJob) => {
    setJobs((prev) => prev.map((j) => (j.jobId === jobId ? updater(j) : j)));
  }, []);

  const openJobStream = useCallback(async (jobId: string) => {
    const token = getAccessToken();
    if (!token) return;

    try {
      const res = await fetch(
        `${API_BASE}/api/admin/recipes/import-url/stream?jobId=${encodeURIComponent(jobId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!res.ok || !res.body) {
        updateJob(jobId, (j) => ({ ...j, status: 'error' }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Split on SSE event boundaries (blank line)
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const dataLine = part.split('\n').find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          const json = dataLine.replace(/^data:\s*/, '').trim();
          if (!json) continue;
          try {
            const event = JSON.parse(json) as {
              step: StepName;
              status: 'running' | 'done' | 'skipped' | 'error';
              message: string;
              recipe?: { id: string; title: string };
            };

            updateJob(jobId, (job) => {
              const newSteps = job.steps.map((s) =>
                s.name === event.step ? { ...s, status: event.status, message: event.message } : s,
              );
              const newStatus: JobStatus =
                event.status === 'error'                          ? 'error'   :
                event.step === 'save' && event.status === 'done' ? 'done'    :
                                                                   'running';
              return {
                ...job,
                steps: newSteps,
                status: newStatus,
                result: event.recipe ?? job.result,
                expanded: newStatus === 'done' ? false : job.expanded,
              };
            });

            if (event.step === 'save' && event.status === 'done') {
              onImportedRef.current?.();
            }
          } catch {
            /* ignore malformed lines */
          }
        }
      }
    } catch {
      updateJob(jobId, (j) => ({ ...j, status: 'error' }));
    }
  }, [updateJob]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const restored = deserializeJobs(stored);
      setJobs(restored);
      for (const job of restored) {
        if (job.status === 'queued' || job.status === 'running') {
          void openJobStream(job.jobId);
        }
      }
    } catch { /* ignore corrupt storage */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    const token = getAccessToken();
    if (!token) {
      setSubmitError('Not authenticated');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/recipes/import-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? `API error ${res.status}`);
      }

      const { jobId } = (await res.json()) as { jobId: string };
      const submittedUrl = url;

      setJobs((prev) => [
        {
          jobId,
          url: submittedUrl,
          status: 'queued',
          steps: makeInitialSteps(),
          startedAt: new Date(),
          expanded: true,
        },
        ...prev,
      ]);
      setUrl('');

      void openJobStream(jobId);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to start import');
    } finally {
      setSubmitting(false);
    }
  }

  function toggleExpanded(jobId: string) {
    setJobs((prev) => prev.map((j) => (j.jobId === jobId ? { ...j, expanded: !j.expanded } : j)));
  }

  function clearCompleted() {
    setJobs((prev) => {
      const active = prev.filter((j) => j.status === 'queued' || j.status === 'running');
      if (active.length === 0) localStorage.removeItem(STORAGE_KEY);
      return active;
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-gray-700" htmlFor="url-input">
          Recipe URL
        </label>
        <div className="flex gap-2">
          <input
            id="url-input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/recipe/..."
            required
            disabled={submitting}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={submitting || !url}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {submitting ? 'Starting…' : 'Import'}
          </button>
        </div>
        <p className="text-xs text-gray-400">
          Imported recipes are <strong>inactive</strong> by default — toggle active after review.
        </p>
        {submitError && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            ✗ {submitError}
          </p>
        )}
      </form>

      {jobs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Import queue</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">
                {jobs.length} job{jobs.length !== 1 ? 's' : ''}
              </span>
              {jobs.some((j) => j.status === 'done' || j.status === 'error') && (
                <button
                  type="button"
                  onClick={clearCompleted}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  Clear completed
                </button>
              )}
            </div>
          </div>
          {jobs.map((job) => (
            <JobRow
              key={job.jobId}
              job={job}
              onToggle={() => toggleExpanded(job.jobId)}
              onTick={() => setTick((n) => n + 1)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
