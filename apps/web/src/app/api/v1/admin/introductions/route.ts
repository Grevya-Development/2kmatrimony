import { ok, parseJson, route } from '@/server/http';
import { createIntroduction, introductionSchema } from '@/server/admin/curation';

/** Send a hand-picked introduction to a member. */
export const POST = route({ admin: 'matchmaker.curate' }, async ({ req, auth }) => ok(await createIntroduction(auth, await parseJson(req, introductionSchema)), { status: 201 }));
