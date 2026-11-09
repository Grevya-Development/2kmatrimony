import fs from 'node:fs';
import path from 'node:path';

// Load apps/web/.env.local so route handlers can reach the local Supabase stack.
const envPath = path.resolve(import.meta.dirname, '../../.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"|"$/g, '');
  }
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('127.0.0.1') && !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('localhost')) {
  throw new Error('Integration tests must run against the LOCAL Supabase stack.');
}
