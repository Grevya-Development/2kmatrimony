import * as React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { BILLING_INTERVAL_LABELS, formatInr, type PlanItem } from '@2k/shared';
import { api, errorMessage } from '@/lib/api';
import { config } from '@/lib/config';
import { keys, useMe, useQuery, useQueryClient } from '@/hooks/queries';
import { colors, space } from '@/theme';
import { Badge, Button, Card, ErrorState, Loading, Notice, Screen, Text } from '@/components/ui';

export default function Billing() {
  const qc = useQueryClient();
  const me = useMe();
  const plans = useQuery({ queryKey: keys.plans, queryFn: () => api.get<PlanItem[]>('/plans') });
  const current = me.data?.plan;

  const openCheckout = async (planCode?: string) => {
    // Razorpay's native SDK isn't bundled; checkout runs securely on the web billing page.
    await WebBrowser.openBrowserAsync(`${config.apiUrl}/app/billing${planCode ? `?plan=${planCode}` : ''}`, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
    await qc.invalidateQueries({ queryKey: keys.me });
  };

  return (
    <Screen edges={[]} refreshing={plans.isRefetching} onRefresh={() => { void plans.refetch(); void me.refetch(); }}>
      <Stack.Screen options={{ title: 'Plans & billing' }} />
      {current && (
        <Card style={{ gap: 4 }}>
          <Text variant="eyebrow">Your plan</Text>
          <Text variant="title">{current.name}</Text>
          {current.currentPeriodEnd && <Text variant="small">Active until {new Date(current.currentPeriodEnd).toLocaleDateString('en-IN')}</Text>}
          <Text variant="small">{current.entitlements.interests_per_day} interests/day · {current.entitlements.daily_recommendations} daily matches{current.entitlements.advanced_filters ? ' · advanced filters' : ''}</Text>
        </Card>
      )}
      <Notice>Prices include GST. Payment and invoices are handled on our secure web checkout; your plan updates here automatically.</Notice>
      {plans.isLoading ? <Loading /> : plans.error ? <ErrorState message={errorMessage(plans.error)} onRetry={() => plans.refetch()} /> : (plans.data ?? []).filter((p) => p.code !== 'free').map((p) => {
        const isCurrent = current?.code === p.code;
        return (
          <Card key={p.id} style={{ gap: space.sm, borderColor: isCurrent ? colors.emerald500 : colors.line }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="title">{p.name}</Text>
              {isCurrent && <Badge label="Current" tone="emerald" />}
            </View>
            {p.tagline && <Text variant="bodyMuted">{p.tagline}</Text>}
            {p.prices.map((pr) => (
              <View key={pr.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text>{BILLING_INTERVAL_LABELS[pr.interval]}</Text>
                <Text variant="label">{formatInr(pr.amountPaise)}{pr.interval !== 'month' ? `  (${formatInr(pr.monthlyEquivalentPaise)}/mo)` : ''}</Text>
              </View>
            ))}
            <Text variant="small">
              {[p.entitlements.advanced_filters && 'Advanced filters', p.entitlements.ai_insights !== 'none' && `${p.entitlements.ai_insights === 'full' ? 'Full' : 'Basic'} AI insights`, p.entitlements.before_you_meet && 'Before You Meet', p.entitlements.human_matchmaker && 'Human matchmaker'].filter(Boolean).join(' · ')}
            </Text>
            {!isCurrent && <Button title={`Choose ${p.name}`} onPress={() => openCheckout(p.code)} />}
          </Card>
        );
      })}
      <Button title="Payment history & invoices" variant="ghost" onPress={() => openCheckout()} />
    </Screen>
  );
}
