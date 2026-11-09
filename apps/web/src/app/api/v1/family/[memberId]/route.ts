import { familyMemberUpdateSchema } from '@2k/shared';
import { parseJson, route } from '@/server/http';
import { revokeFamilyMember, updateFamilyMember } from '@/server/family/service';

export const PATCH = route<{ memberId: string }>({ profile: 'required' }, async ({ req, auth, params }) =>
  updateFamilyMember(auth, params.memberId, await parseJson(req, familyMemberUpdateSchema)),
);

export const DELETE = route<{ memberId: string }>({ profile: 'required' }, async ({ auth, params }) => {
  await revokeFamilyMember(auth, params.memberId);
  return { revoked: true };
});
