'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import { ImportSubStep } from '@mealy/types';

type StepName =
  | 'fetch'
  | 'extract'
  | 'verify'
  | 'group'
  | 'normalize'
  | 'canonicalize'
  | 'duplicate-check'
  | 'save';
type StepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'error';
type JobStatus = 'queued' | 'running' | 'done' | 'error';

interface Step {
  name: StepName;
  label: string;
  status: StepStatus;
  message: string;
  subSteps: ImportSubStep[];
}

const SUBSTEP_LABELS: Record<string, string> = {
  request: 'Requesting page',
  capture: 'Extracting HTML',
  browser: 'Using browser',
  jsonld: 'Checking structured data',
  prepare: 'Preparing for LLM',
  llm: 'Calling LLM',
  analyze: 'Analyzing',
  fix: 'Applying fixes',
  assign: 'Assigning groups',
  catalog: 'Loading catalog',
  match: 'Matching ingredients',
  write: 'Saving to database',
};

const AI_SUBSTEPS = new Set(['llm', 'analyze', 'fix', 'match']);

function isBrowserSubStep(ss: ImportSubStep): boolean {
  return ss.name === 'browser';
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
  { name: 'fetch', label: 'Fetch page' },
  { name: 'extract', label: 'Extract recipe data' },
  { name: 'verify', label: 'Verify & fix quality' },
  { name: 'group', label: 'Group ingredients' },
  { name: 'normalize', label: 'Normalize' },
  { name: 'canonicalize', label: 'Canonicalize' },
  { name: 'duplicate-check', label: 'Check duplicates' },
  { name: 'save', label: 'Save recipe' },
];

function makeInitialSteps(): Step[] {
  return STEP_DEFS.map(({ name, label }) => ({
    name,
    label,
    status: 'pending',
    message: '',
    subSteps: [],
  }));
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
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    );
  if (status === 'done')
    return (
      <svg
        className="w-4 h-4 text-olive shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  if (status === 'skipped')
    return (
      <svg
        className="w-4 h-4 text-gray-400 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
      </svg>
    );
  return (
    <svg
      className="w-4 h-4 text-red-500 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SubStepIcon({ status }: { status: StepStatus }) {
  if (status === 'running')
    return (
      <svg className="w-3 h-3 animate-spin text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    );
  if (status === 'done')
    return (
      <svg
        className="w-3 h-3 text-olive shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  if (status === 'skipped')
    return (
      <span className="w-3 h-3 shrink-0 flex items-center justify-center text-gray-300 text-[10px]">
        —
      </span>
    );
  if (status === 'error')
    return (
      <svg
        className="w-3 h-3 text-red-400 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  return null;
}

function JobStatusIcon({ status }: { status: JobStatus }) {
  if (status === 'queued' || status === 'running')
    return (
      <svg
        className={`w-4 h-4 shrink-0 ${status === 'running' ? 'animate-spin text-blue-500' : 'text-gray-400'}`}
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    );
  if (status === 'done')
    return (
      <svg
        className="w-4 h-4 text-olive shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  return (
    <svg
      className="w-4 h-4 text-red-500 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function JobRow({
  job,
  onToggle,
  onTick,
  onForceRetry,
}: {
  job: ImportJob;
  onToggle: () => void;
  onTick: () => void;
  onForceRetry: (jobId: string) => void;
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

  const isDuplicateError =
    job.status === 'error' &&
    job.steps.find((s) => s.name === 'duplicate-check' && s.status === 'error');

  return (
    <div
      className={`border rounded-lg overflow-hidden text-sm ${
        job.status === 'error'
          ? 'border-red-200'
          : job.status === 'done'
            ? 'border-olive-subtle'
            : job.status === 'running'
              ? 'border-blue-200'
              : 'border-gray-200'
      }`}
    >
      <div
        className={`flex items-center gap-3 px-4 py-2.5 ${
          job.status === 'error'
            ? 'bg-red-50'
            : job.status === 'done'
              ? 'bg-olive-subtle'
              : job.status === 'running'
                ? 'bg-blue-50'
                : 'bg-gray-50'
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center gap-3 text-left hover:brightness-95 transition-all min-w-0"
        >
          <JobStatusIcon status={job.status} />
          <span className="flex-1 font-mono text-xs text-gray-700 truncate min-w-0">
            {shortUrl}
          </span>
          {job.status === 'done' && job.result && (
            <span className="shrink-0 text-xs text-olive font-medium max-w-[160px] truncate">
              &ldquo;{job.result.title}&rdquo;
            </span>
          )}
          {job.status === 'error' && (
            <span className="shrink-0 text-xs text-red-600 font-medium">Failed</span>
          )}
          <span className="shrink-0 text-xs text-gray-400">{elapsed(job.startedAt)}</span>
          <svg
            className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${job.expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isDuplicateError && (
          <button
            type="button"
            onClick={() => onForceRetry(job.jobId)}
            className="shrink-0 text-xs px-2 py-1 bg-olive text-white rounded hover:bg-olive-dark transition-colors"
          >
            Force import
          </button>
        )}
      </div>

      {job.expanded && (
        <div className="border-t border-gray-100 font-mono divide-y divide-gray-100">
          {job.steps.map((step) => (
            <div key={step.name}>
              <div
                className={`flex items-center gap-3 px-4 py-2 ${
                  step.status === 'running'
                    ? 'bg-blue-50'
                    : step.status === 'error'
                      ? 'bg-red-50'
                      : step.status === 'skipped'
                        ? 'opacity-40'
                        : ''
                }`}
              >
                <StepIcon status={step.status} />
                <span
                  className={`text-xs font-medium ${
                    step.status === 'error'
                      ? 'text-red-700'
                      : step.status === 'done'
                        ? 'text-gray-800'
                        : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </span>
                {step.message && (
                  <span className="ml-auto text-xs text-gray-400 truncate max-w-[50%]">
                    {step.message}
                  </span>
                )}
              </div>
              {(step.status === 'running' || step.status === 'error') &&
                step.subSteps
                  .filter((ss) => ss.status !== 'pending')
                  .map((ss) => (
                    <div
                      key={ss.name}
                      className={`flex items-center gap-2 px-4 py-1 pl-10 ${
                        step.status === 'running' ? 'bg-blue-50' : 'bg-red-50'
                      }`}
                    >
                      <SubStepIcon status={ss.status} />
                      <span className="text-xs text-gray-400">
                        {SUBSTEP_LABELS[ss.name] ?? ss.name}
                      </span>
                      {AI_SUBSTEPS.has(ss.name) && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-500 leading-none">
                          ✦ AI
                        </span>
                      )}
                      {isBrowserSubStep(ss) && (
                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium bg-sky-100 text-sky-500 leading-none">
                          ◎ Browser
                        </span>
                      )}
                      {ss.message && (
                        <span className="ml-auto text-xs text-gray-300 truncate max-w-[40%]">
                          {ss.message}
                        </span>
                      )}
                    </div>
                  ))}
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
  const [urlsText, setUrlsText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [, setTick] = useState(0);
  const onImportedRef = useRef(onImported);
  useEffect(() => {
    onImportedRef.current = onImported;
  }, [onImported]);

  useEffect(() => {
    if (jobs.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  }, [jobs]);

  const pollIntervals = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const lastFingerprints = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const intervals = pollIntervals.current;
    return () => {
      for (const id of intervals.values()) clearInterval(id);
    };
  }, []);

  const pollJobStatus = useCallback((jobId: string) => {
    const existing = pollIntervals.current.get(jobId);
    if (existing) clearInterval(existing);

    const id = setInterval(async () => {
      try {
        const snapshot = await adminApi.getImportJobStatus(jobId);

        const fingerprint = `${snapshot.jobStatus}|${snapshot.steps
          .map(
            (s) =>
              `${s.status}:${s.message}:${s.subSteps.map((ss) => `${ss.name}:${ss.status}:${ss.message}`).join(',')}`,
          )
          .join('|')}`;

        if (fingerprint !== lastFingerprints.current.get(jobId)) {
          lastFingerprints.current.set(jobId, fingerprint);
          setJobs((prev) =>
            prev.map((j) => {
              if (j.jobId !== jobId) return j;
              return {
                ...j,
                status: snapshot.jobStatus,
                steps: j.steps.map((s) => {
                  const snap = snapshot.steps.find((st) => st.step === s.name);
                  if (!snap) return s;
                  return {
                    ...s,
                    status: snap.status,
                    message: snap.message,
                    subSteps: snap.subSteps,
                  };
                }),
                result: snapshot.result ?? j.result,
                expanded: snapshot.jobStatus === 'done' ? false : j.expanded,
              };
            }),
          );
        }

        if (snapshot.jobStatus === 'done' || snapshot.jobStatus === 'error') {
          clearInterval(id);
          pollIntervals.current.delete(jobId);
          lastFingerprints.current.delete(jobId);
          if (snapshot.jobStatus === 'done') onImportedRef.current?.();
        }
      } catch {
        clearInterval(id);
        pollIntervals.current.delete(jobId);
        lastFingerprints.current.delete(jobId);
        setJobs((prev) => prev.map((j) => (j.jobId === jobId ? { ...j, status: 'error' } : j)));
      }
    }, 500);

    pollIntervals.current.set(jobId, id);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const restored = deserializeJobs(stored);
      setJobs(restored);
      for (const job of restored) {
        if (job.status === 'queued' || job.status === 'running') {
          pollJobStatus(job.jobId);
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!urlsText.trim() || submitting) return;

    const urls = urlsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const invalid = urls.filter((u) => {
      try {
        new URL(u);
        return false;
      } catch {
        return true;
      }
    });

    if (invalid.length > 0) {
      setSubmitError(`Invalid URL${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}`);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const errors: string[] = [];
    const started: ImportJob[] = [];

    for (const u of urls) {
      try {
        const { jobId } = await adminApi.importFromUrl(u);
        const job: ImportJob = {
          jobId,
          url: u,
          status: 'queued',
          steps: makeInitialSteps(),
          startedAt: new Date(),
          expanded: urls.length === 1,
        };
        started.push(job);
        setJobs((prev) => [job, ...prev]);
        pollJobStatus(jobId);
      } catch (err) {
        errors.push(`${u}: ${err instanceof Error ? err.message : 'Failed to start'}`);
      }
    }

    if (started.length > 0) setUrlsText('');
    if (errors.length > 0) setSubmitError(errors.join('\n'));

    setSubmitting(false);
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

  async function handleForceRetry(jobId: string) {
    try {
      await adminApi.resumeImportJob(jobId);
      // Job already exists in state, just update its status and poll
      setJobs((prev) =>
        prev.map((j) =>
          j.jobId === jobId ? { ...j, status: 'running' as const, expanded: true } : j,
        ),
      );
      pollJobStatus(jobId);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to resume import');
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-sm font-medium text-gray-700" htmlFor="url-input">
          Recipe URL(s)
        </label>
        <textarea
          id="url-input"
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          placeholder={'https://example.com/recipe/...\nhttps://example.com/another-recipe/...'}
          required
          rows={3}
          disabled={submitting}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 resize-y font-mono"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-400">
            One URL per line. Imported recipes are <strong>inactive</strong> by default — toggle
            active after review.
          </p>
          <button
            type="submit"
            disabled={submitting || !urlsText.trim()}
            className="shrink-0 px-4 py-2 bg-olive text-white text-sm font-medium rounded-lg hover:bg-olive-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {submitting ? 'Starting…' : 'Import'}
          </button>
        </div>
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
              onForceRetry={handleForceRetry}
            />
          ))}
        </div>
      )}
    </div>
  );
}
