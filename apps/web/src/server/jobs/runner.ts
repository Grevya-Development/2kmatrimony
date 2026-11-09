import 'server-only';

export interface JobOutcome { name: string; ok: boolean; ms: number; result?: unknown; error?: string }

/** Run jobs sequentially, isolating failures; returns a JSON-safe summary. */
export async function runJobs(jobs: [name: string, fn: () => Promise<unknown>][]): Promise<{ ok: boolean; jobs: JobOutcome[] }> {
  const out: JobOutcome[] = [];
  for (const [name, fn] of jobs) {
    const started = Date.now();
    try {
      out.push({ name, ok: true, ms: Date.now() - started, result: await fn() });
      out[out.length - 1]!.ms = Date.now() - started;
    } catch (err) {
      console.error(`[cron] ${name} failed`, err);
      out.push({ name, ok: false, ms: Date.now() - started, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { ok: out.every((j) => j.ok), jobs: out };
}

/** Map with bounded concurrency. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return results;
}
