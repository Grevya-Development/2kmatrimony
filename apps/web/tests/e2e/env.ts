import fs from 'node:fs';
import path from 'node:path';

export const isHosted = () => process.env.E2E_TARGET === 'hosted';

/** Load env for tests: hosted mode reads .env.hosted.local first, then .env.local for the rest. */
export function loadEnv(): void {
  const files = isHosted() ? ['.env.hosted.local', '.env.local'] : ['.env.local'];
  for (const f of files) {
    const envPath = path.resolve(import.meta.dirname, '../..', f);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, '');
    }
  }
}
