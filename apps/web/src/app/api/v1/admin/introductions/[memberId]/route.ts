import { route } from '@/server/http';
import { introductionWorkspace } from '@/server/admin/curation';

/** Member summary, ranked candidates and recent introductions. */
export const GET = route<{ memberId: string }>({ admin: 'matchmaker.curate' }, async ({ params }) => introductionWorkspace(params.memberId));
