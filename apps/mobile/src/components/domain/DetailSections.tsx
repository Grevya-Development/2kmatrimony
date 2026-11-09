import * as React from 'react';
import { View } from 'react-native';
import {
  CHILDREN_OPTIONS, DIET_OPTIONS, EMPLOYMENT_TYPE_OPTIONS, FAMILY_STRUCTURE_OPTIONS, FAMILY_VALUES_OPTIONS, FITNESS_OPTIONS, HABIT_OPTIONS,
  INCOME_RANGE_OPTIONS, LIVING_OPTIONS, MARITAL_STATUS_OPTIONS, RELOCATION_OPTIONS, SETTLE_OPTIONS, TRAVEL_OPTIONS, formatHeight, labelOf,
  type ProfileDetail,
} from '@2k/shared';
import { space } from '@/theme';
import { Badge, Card, Text } from '@/components/ui';

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: 6 }}>
      <Text variant="bodyMuted">{label}</Text>
      <Text variant="body" style={{ flexShrink: 1, textAlign: 'right' }}>{String(value)}</Text>
    </View>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card style={{ gap: 4 }}><Text variant="heading" accessibilityRole="header" style={{ marginBottom: 4 }}>{title}</Text>{children}</Card>;
}

/** Read-only profile sections (respects hiddenSections from the privacy projection). */
export function DetailSections({ d }: { d: ProfileDetail }) {
  const hidden = new Set(d.hiddenSections);
  return (
    <View style={{ gap: space.md }}>
      {d.basics.about && <Block title="About"><Text variant="body">{d.basics.about}</Text></Block>}
      <Block title="Basics">
        <Row label="Height" value={formatHeight(d.basics.heightCm)} />
        <Row label="Marital status" value={labelOf(MARITAL_STATUS_OPTIONS, d.basics.maritalStatus)} />
        <Row label="Mother tongue" value={d.basics.motherTongue} />
        <Row label="Languages" value={d.basics.languages.join(', ')} />
        <Row label="Native place" value={d.basics.nativePlace} />
        <Row label="Religion" value={d.basics.religion} />
        <Row label="Community" value={d.basics.community} />
        {hidden.has('religion_community') && <Text variant="small">Some details are shared only with connections.</Text>}
      </Block>
      {(d.basics.coreValues.length > 0 || d.basics.personalityTraits.length > 0) && (
        <Block title="Values & personality">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {d.basics.coreValues.map((v) => <Badge key={v} label={v} tone="emerald" />)}
            {d.basics.personalityTraits.map((v) => <Badge key={v} label={v} tone="neutral" />)}
          </View>
        </Block>
      )}
      {d.educationHistory.length > 0 && (
        <Block title="Education">
          {d.educationHistory.map((e, i) => <Text key={i} variant="body">{e.qualification}{e.specialization ? `, ${e.specialization}` : ''}{e.institution ? ` — ${e.institution}` : ''}</Text>)}
        </Block>
      )}
      {d.career && (
        <Block title="Career">
          <Row label="Profession" value={d.career.profession} />
          <Row label="Role" value={d.career.designation} />
          <Row label="Company" value={d.career.company} />
          <Row label="Sector" value={labelOf(EMPLOYMENT_TYPE_OPTIONS, d.career.employmentType)} />
          <Row label="Income" value={d.career.incomeRange ? labelOf(INCOME_RANGE_OPTIONS, d.career.incomeRange) : hidden.has('income') ? 'Shared with connections' : null} />
          <Row label="Works in" value={d.career.workCity} />
          <Row label="Relocation" value={labelOf(RELOCATION_OPTIONS, d.career.relocationWillingness)} />
        </Block>
      )}
      {d.family && (
        <Block title="Family">
          <Row label="Family type" value={labelOf(FAMILY_STRUCTURE_OPTIONS, d.family.familyStructure)} />
          <Row label="Family values" value={labelOf(FAMILY_VALUES_OPTIONS, d.family.familyValues)} />
          <Row label="Father" value={d.family.fatherOccupation} />
          <Row label="Mother" value={d.family.motherOccupation} />
          <Row label="Siblings" value={d.family.brothers !== null || d.family.sisters !== null ? `${d.family.brothers ?? 0} brother(s), ${d.family.sisters ?? 0} sister(s)` : null} />
          {d.family.familyBackground && <Text variant="bodyMuted">{d.family.familyBackground}</Text>}
        </Block>
      )}
      {d.lifestyle && (
        <Block title="Lifestyle">
          <Row label="Diet" value={labelOf(DIET_OPTIONS, d.lifestyle.diet)} />
          <Row label="Smoking" value={labelOf(HABIT_OPTIONS, d.lifestyle.smoking)} />
          <Row label="Drinking" value={labelOf(HABIT_OPTIONS, d.lifestyle.drinking)} />
          <Row label="Fitness" value={labelOf(FITNESS_OPTIONS, d.lifestyle.fitness)} />
          <Row label="Travel" value={labelOf(TRAVEL_OPTIONS, d.lifestyle.travel)} />
          {[...d.lifestyle.interests, ...d.lifestyle.hobbies].length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {[...new Set([...d.lifestyle.interests, ...d.lifestyle.hobbies])].map((i) => <Badge key={i} label={i} tone={d.sharedInterests.includes(i) ? 'gold' : 'neutral'} />)}
            </View>
          )}
        </Block>
      )}
      {d.values && (
        <Block title="Looking ahead">
          <Row label="Children" value={labelOf(CHILDREN_OPTIONS, d.values.childrenPreference)} />
          <Row label="After marriage" value={labelOf(LIVING_OPTIONS, d.values.livingArrangement)} />
          <Row label="Settle in" value={labelOf(SETTLE_OPTIONS, d.values.settlePreference)} />
          {d.values.relationshipExpectations && <Text variant="bodyMuted">{d.values.relationshipExpectations}</Text>}
          {d.values.futureGoals && <Text variant="bodyMuted">{d.values.futureGoals}</Text>}
        </Block>
      )}
      <Text variant="small">Details above are the member’s own statements unless marked verified.</Text>
    </View>
  );
}
