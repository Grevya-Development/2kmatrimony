import { route } from '@/server/http';
import { listScreeningQueue } from '@/server/admin/curation';

/** Profiles waiting for human review, oldest first. */
export const GET = route({ admin: 'profiles.moderate' }, async () => listScreeningQueue());
