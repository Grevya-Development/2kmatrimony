import * as React from 'react';
import { View } from 'react-native';
import type { MatchExplanation } from '@2k/shared';
import { colors, fonts, space } from '@/theme';
import { Badge, Card, Text } from '@/components/ui';

function Bar({ value }: { value: number | null }) {
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden', flex: 1 }}>
      {value !== null && <View style={{ height: 6, width: `${value}%`, backgroundColor: colors.burgundy500 }} />}
    </View>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone: 'success' | 'warning' | 'info' }) {
  if (!items.length) return null;
  const color = tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : colors.info;
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">{title}</Text>
      {items.map((t) => (
        <View key={t} style={{ flexDirection: 'row', gap: 8 }}>
          <Text style={{ color }}>•</Text>
          <Text variant="body" style={{ flex: 1 }}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

/** Transparent, mutual compatibility explanation. Never a promise of outcomes. */
export function CompatibilityPanel({ explanation }: { explanation: MatchExplanation }) {
  const c = explanation.compatibility;
  return (
    <Card style={{ gap: space.lg }}>
      <View style={{ gap: 4 }}>
        <Text variant="eyebrow">Why you might align</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <Text style={{ fontFamily: fonts.display, fontSize: 44, color: colors.burgundy700 }} accessibilityLabel={`Mutual compatibility ${c.mutual} percent`}>{c.mutual}%</Text>
          <Text variant="label">{c.label}</Text>
        </View>
        <Text variant="bodyMuted">{explanation.headline}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
          <Badge label={`They fit you: ${c.forViewer}%`} tone="neutral" />
          <Badge label={`You fit them: ${c.forCandidate}%`} tone="neutral" />
          {explanation.generator === 'ai' && <Badge label="AI-written summary" tone="info" />}
        </View>
      </View>
      <View style={{ gap: 10 }}>
        {explanation.dimensions.map((d) => (
          <View key={d.key} style={{ gap: 4 }} accessible accessibilityLabel={`${d.label}: ${d.score === null ? 'not enough information' : `${d.score} percent`}. ${d.note}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text variant="label" style={{ width: 128 }} numberOfLines={1}>{d.label}</Text>
              <Bar value={d.score} />
              <Text variant="small" style={{ width: 34, textAlign: 'right' }}>{d.score === null ? '—' : `${d.score}`}</Text>
            </View>
            <Text variant="small">{d.note}</Text>
          </View>
        ))}
      </View>
      <List title="Where you align" items={explanation.alignments} tone="success" />
      <List title="Worth talking about" items={explanation.differences} tone="warning" />
      <List title="Mutual preferences" items={explanation.mutualPreferenceNotes} tone="info" />
      {explanation.missingInformation.length > 0 && <Text variant="small">Not enough information yet about: {explanation.missingInformation.join(', ')}.</Text>}
      <List title="Conversation starters" items={explanation.conversationStarters} tone="info" />
      <Text variant="small" style={{ fontStyle: 'italic' }}>{explanation.disclaimer}</Text>
    </Card>
  );
}
