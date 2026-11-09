import { route } from '@/server/http';
import { searchMembers } from '@/server/admin/curation';

export const GET = route({ admin: 'matchmaker.curate' }, async ({ req }) => searchMembers(new URL(req.url).searchParams.get('q') ?? ''));
