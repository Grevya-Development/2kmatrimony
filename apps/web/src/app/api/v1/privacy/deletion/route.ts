import { deleteAccountSchema } from '@2k/shared';
import { ok, parseJson, route } from '@/server/http';
import { cancelDeletion, scheduleDeletion } from '@/server/privacy/deletion';

export const POST = route({ allowSuspended: true }, async ({ req, auth }) => {
  const input = await parseJson(req, deleteAccountSchema);
  return ok(await scheduleDeletion(auth, input.reason ?? null), { status: 201 });
});

export const DELETE = route({ allowSuspended: true }, async ({ auth }) => cancelDeletion(auth));
