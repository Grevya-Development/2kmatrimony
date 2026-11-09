'use client';
import * as React from 'react';
import Link from 'next/link';
import { AUDIENCE_OPTIONS, PHOTO_VISIBILITY_OPTIONS, privacySchema, type PrivacyInput } from '@2k/shared';
import { Button } from '@/components/ui';
import { FormSection, SelectField, useSectionSave } from './form-kit';

export function PrivacyForm({ initial, onSaved }: { initial: PrivacyInput; onSaved?: () => void }) {
  const [v, setV] = React.useState<PrivacyInput>(initial);
  const { saving, save } = useSectionSave(privacySchema, '/profile/privacy');
  const set = <K extends keyof PrivacyInput>(k: K, val: PrivacyInput[K]) => setV((p) => ({ ...p, [k]: val }));
  return (
    <form noValidate onSubmit={async (e) => { e.preventDefault(); const r = await save(v); if (r.ok) onSaved?.(); }} className="space-y-8">
      <FormSection title="Who can find you" description="Profiles are never public — only signed-in members can see them.">
        <SelectField id="visibility" label="Profile visibility" value={v.visibility} onChange={(x) => x && set('visibility', x)} options={[
          { value: 'members', label: 'Discoverable by members' }, { value: 'connections', label: 'Only my existing connections' }, { value: 'hidden', label: 'Hidden — pause my profile' },
        ]} placeholder="Choose" hint="Hidden profiles don't appear in search or recommendations." />
        <SelectField id="photoVisibility" label="Photos" value={v.photoVisibility} onChange={(x) => x && set('photoVisibility', x)} options={PHOTO_VISIBILITY_OPTIONS} placeholder="Choose" />
        <SelectField id="sensitive" label="Religion, community and family details" value={v.sensitiveFieldsVisibility} onChange={(x) => x && set('sensitiveFieldsVisibility', x)} options={AUDIENCE_OPTIONS} placeholder="Choose" />
        <SelectField id="nameVis" label="Name shown to members" value={v.nameVisibility} onChange={(x) => x && set('nameVisibility', x)} options={[
          { value: 'first_name', label: 'First name and last initial' }, { value: 'full', label: 'Full name' }, { value: 'initials', label: 'Initials only' },
        ]} placeholder="Choose" />
        <SelectField id="messaging" label="Who can message you" value={v.messagingPolicy} onChange={(x) => x && set('messagingPolicy', x)} options={[
          { value: 'connections', label: 'Mutual connections' }, { value: 'connections_verified', label: 'Only verified mutual connections' },
        ]} placeholder="Choose" />
      </FormSection>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="link"><Link href="/app/profile?preview=1">Preview how others see you</Link></Button>
        <Button type="submit" loading={saving}>Save privacy settings</Button>
      </div>
    </form>
  );
}
