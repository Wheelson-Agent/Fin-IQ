export interface PerfNavigationMark {
  key: string;
  startedAt: number;
  wallClockAt: number;
  meta: Record<string, unknown>;
}

const PERF_STORAGE_PREFIX = 'finiq:perf:';

export const nowMs = () => performance.now();

export const formatPerfMs = (durationMs: number) => `${durationMs.toFixed(1)} ms`;

export function logPerf(scope: string, label: string, startedAt: number, details?: Record<string, unknown>) {
  const durationMs = nowMs() - startedAt;
  if (details && Object.keys(details).length > 0) {
    console.log(`[Perf][${scope}] ${label}: ${formatPerfMs(durationMs)}`, details);
  } else {
    console.log(`[Perf][${scope}] ${label}: ${formatPerfMs(durationMs)}`);
  }
  return durationMs;
}

export function savePerfNavigationMark(key: string, meta: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;

  const payload: PerfNavigationMark = {
    key,
    startedAt: nowMs(),
    wallClockAt: Date.now(),
    meta,
  };

  try {
    window.sessionStorage.setItem(`${PERF_STORAGE_PREFIX}${key}`, JSON.stringify(payload));
  } catch (error) {
    console.warn('[Perf] Failed to save navigation mark', error);
  }
}

export function consumePerfNavigationMark(key: string): PerfNavigationMark | null {
  if (typeof window === 'undefined') return null;

  try {
    const storageKey = `${PERF_STORAGE_PREFIX}${key}`;
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    window.sessionStorage.removeItem(storageKey);
    return JSON.parse(raw) as PerfNavigationMark;
  } catch (error) {
    console.warn('[Perf] Failed to read navigation mark', error);
    return null;
  }
}
