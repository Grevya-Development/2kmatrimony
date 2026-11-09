import * as React from 'react';
import { Alert } from 'react-native';
import { router, type Href } from 'expo-router';
import type { ProfileCard, SendInterestResult } from '@2k/shared';
import { api, ApiClientError, errorMessage } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { useRelationshipInvalidation } from '@/hooks/queries';
import { Button, IconButton, Icon } from '@/components/ui';
import { colors } from '@/theme';

export function handleEntitlementError(e: unknown): boolean {
  if (e instanceof ApiClientError && e.code === 'entitlement_required') {
    // Everything is free; the only limits are anti-abuse daily caps.
    Alert.alert('Daily limit reached', 'To keep the community safe we cap this per day. Please try again tomorrow.');
    return true;
  }
  return false;
}

/** State-aware primary action (interest / accept / withdraw / message). */
export function useProfileActions(card: ProfileCard) {
  const invalidate = useRelationshipInvalidation();
  const [busy, setBusy] = React.useState<string | null>(null);
  const run = async (label: string, fn: () => Promise<unknown>, success?: () => void) => {
    setBusy(label);
    try { await fn(); haptic.success(); success?.(); invalidate(); }
    catch (e) { if (!handleEntitlementError(e)) Alert.alert('Something went wrong', errorMessage(e)); }
    finally { setBusy(null); }
  };
  const rel = card.relationship;
  return {
    busy,
    sendInterest: (message?: string) => run('interest', async () => {
      const r = await api.post<SendInterestResult>('/interests', { receiverProfileId: card.id, message: message ?? null });
      if (r.autoAccepted) Alert.alert('You’re connected', `${card.displayName} had already expressed interest in you. You can start a conversation.`);
    }),
    respond: (action: 'accept' | 'decline' | 'withdraw') => rel.interest && run(action, () => api.post(`/interests/${rel.interest!.id}`, { action })),
    shortlist: () => run('shortlist', () => (rel.shortlisted ? api.del(`/shortlist/${card.id}`) : api.post('/shortlist', { targetProfileId: card.id }))),
    pass: () => run('pass', () => api.post('/passes', { targetProfileId: card.id })),
    undoPass: () => run('undo', () => api.del(`/passes/${card.id}`)),
    openChat: () => rel.conversationId && router.push(`/chat/${rel.conversationId}` as Href),
  };
}

export function PrimaryAction({ card, size = 'md' }: { card: ProfileCard; size?: 'sm' | 'md' }) {
  const a = useProfileActions(card);
  const rel = card.relationship;
  if (rel.conversationId) return <Button title="Message" size={size} onPress={a.openChat} />;
  if (rel.interest?.direction === 'received' && rel.interest.status === 'pending') {
    return <>
      <Button title="Accept" size={size} loading={a.busy === 'accept'} onPress={() => a.respond('accept')} />
      <Button title="Decline" size={size} variant="secondary" loading={a.busy === 'decline'} onPress={() => a.respond('decline')} />
    </>;
  }
  if (rel.interest?.direction === 'sent' && rel.interest.status === 'pending') {
    return <Button title="Interest sent · Withdraw" size={size} variant="secondary" loading={a.busy === 'withdraw'} onPress={() => a.respond('withdraw')} />;
  }
  return <Button title="Express interest" size={size} loading={a.busy === 'interest'} onPress={() => a.sendInterest()} icon={<Icon name="heart" size={16} color={colors.white} />} />;
}

export function ShortlistButton({ card }: { card: ProfileCard }) {
  const a = useProfileActions(card);
  return (
    <IconButton label={card.relationship.shortlisted ? 'Remove from shortlist' : 'Add to shortlist'} onPress={a.shortlist}>
      <Icon name="bookmark" color={card.relationship.shortlisted ? colors.emerald600 : colors.ink2} />
    </IconButton>
  );
}
