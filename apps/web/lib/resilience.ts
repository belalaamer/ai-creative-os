import type { ProviderConfig } from './provider-router';

type AttemptMeta = {
  provider: string;
  model: string;
  routeKey: string;
  attempt: number;
  latencyMs: number;
  status: 'succeeded' | 'failed' | 'timed_out';
  error?: string;
};

export class ProviderExhaustedError extends Error {
  attempts: AttemptMeta[];
  constructor(attempts: AttemptMeta[]) {
    super('All configured AI providers failed');
    this.name = 'ProviderExhaustedError';
    this.attempts = attempts;
  }
}

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

export async function withTimeout<T>(promiseFactory: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await promiseFactory(controller.signal); }
  finally { clearTimeout(timer); }
}

export async function executeWithFailover<T>({
  candidates,
  run,
  maxRetriesPerProvider = 1,
  maxFailovers = 2,
  timeoutMs = 90_000,
  onAttempt,
}: {
  candidates: ProviderConfig[];
  run: (provider: ProviderConfig, signal: AbortSignal) => Promise<T>;
  maxRetriesPerProvider?: number;
  maxFailovers?: number;
  timeoutMs?: number;
  onAttempt?: (meta: AttemptMeta) => Promise<void> | void;
}): Promise<{ result: T; provider: ProviderConfig; attempts: AttemptMeta[] }> {
  const attempts: AttemptMeta[] = [];
  const providerLimit = Math.min(candidates.length, Math.max(1, maxFailovers + 1));

  for (let p = 0; p < providerLimit; p++) {
    const provider = candidates[p];
    for (let attempt = 0; attempt <= maxRetriesPerProvider; attempt++) {
      const started = Date.now();
      try {
        const result = await withTimeout((signal) => run(provider, signal), provider.timeoutMs ?? timeoutMs);
        const meta: AttemptMeta = { provider: provider.provider, model: provider.model, routeKey: provider.routeKey, attempt: attempt + 1, latencyMs: Date.now() - started, status: 'succeeded' };
        attempts.push(meta); await onAttempt?.(meta);
        return { result, provider, attempts };
      } catch (error) {
        const aborted = error instanceof DOMException && error.name === 'AbortError';
        const meta: AttemptMeta = { provider: provider.provider, model: provider.model, routeKey: provider.routeKey, attempt: attempt + 1, latencyMs: Date.now() - started, status: aborted ? 'timed_out' : 'failed', error: error instanceof Error ? error.message : String(error) };
        attempts.push(meta); await onAttempt?.(meta);
        if (attempt < maxRetriesPerProvider) await sleep(Math.min(250 * 2 ** attempt, 2000));
      }
    }
  }
  throw new ProviderExhaustedError(attempts);
}
