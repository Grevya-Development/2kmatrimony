import * as React from 'react';
import { ActionSheetIOS, Alert, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ConversationItem, MessageItem } from '@2k/shared';
import { api, errorMessage, newClientId } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { pickImage, uploadAsset } from '@/lib/upload';
import { haptic } from '@/lib/haptics';
import { keys, useMe, useQuery, useQueryClient } from '@/hooks/queries';
import { colors, fonts, radius, space } from '@/theme';
import { Avatar, ErrorState, Icon, Loading, Notice, Text } from '@/components/ui';
import { SafetySheet } from '@/components/domain/SafetySheet';

type Local = MessageItem & { status?: 'sending' | 'failed'; localUri?: string };
interface Page { items: MessageItem[]; otherLastReadAt: string | null }
interface Row { id: string; conversation_id: string; sender_profile_id: string | null; kind: 'text' | 'image' | 'system'; body: string | null; media_path: string | null; client_id: string | null; created_at: string }

export default function ChatThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const me = useMe();
  const myProfileId = me.data?.profile?.id ?? null;
  const conv = useQuery({ queryKey: ['conversation', id], queryFn: () => api.get<ConversationItem>(`/conversations/${id}`) });
  const pages = useInfiniteQuery({
    queryKey: keys.messages(id),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.request<Page>(`/conversations/${id}/messages`, { query: { cursor: pageParam, limit: 40 } }),
    getNextPageParam: (l) => l.nextCursor ?? undefined,
  });
  const [extra, setExtra] = React.useState<Local[]>([]); // realtime + optimistic, newest first
  const [otherReadAt, setOtherReadAt] = React.useState<string | null>(null);
  const [typing, setTyping] = React.useState(false);
  const [online, setOnline] = React.useState(false);
  const [text, setText] = React.useState('');
  const [safety, setSafety] = React.useState(false);
  const channelRef = React.useRef<RealtimeChannel | null>(null);
  const typingTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = React.useRef(0);

  const refetchRef = React.useRef(pages.refetch);
  refetchRef.current = pages.refetch;
  const fetched: MessageItem[] = pages.data?.pages.flatMap((p) => p.data.items) ?? [];
  React.useEffect(() => { const r = pages.data?.pages[0]?.data.otherLastReadAt; if (r) setOtherReadAt(r); }, [pages.data]);

  // Merge, newest first, de-duplicated by id and clientId.
  const messages = React.useMemo(() => {
    const seen = new Set<string>();
    const out: Local[] = [];
    for (const m of [...extra, ...fetched].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      const k = m.clientId ?? m.id;
      if (seen.has(m.id) || seen.has(k)) continue;
      seen.add(m.id); seen.add(k);
      out.push(m);
    }
    return out;
  }, [extra, fetched]);

  const markRead = React.useCallback(() => {
    api.post(`/conversations/${id}/read`).then(() => qc.invalidateQueries({ queryKey: keys.conversations })).catch(() => undefined);
  }, [id, qc]);
  React.useEffect(() => { markRead(); }, [markRead]);

  // Realtime: new messages, read receipts, typing (broadcast) and online (presence).
  React.useEffect(() => {
    if (!myProfileId || !id) return;
    const ch = supabase.channel(`conversation:${id}`, { config: { private: true, broadcast: { self: false }, presence: { key: myProfileId } } });
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (payload) => {
      const r = payload.new as Row;
      if (r.kind === 'image') { void refetchRef.current(); return; }
      const item: Local = { id: r.id, conversationId: r.conversation_id, senderProfileId: r.sender_profile_id, kind: r.kind, body: r.body, mediaUrl: null, clientId: r.client_id, createdAt: r.created_at, isMine: r.sender_profile_id === myProfileId };
      setExtra((prev) => [item, ...prev.filter((p) => p.clientId !== r.client_id || !r.client_id)]);
      if (!item.isMine) { setTyping(false); markRead(); }
    });
    ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `conversation_id=eq.${id}` }, (payload) => {
      const row = payload.new as { profile_id: string; last_read_at: string | null };
      if (row.profile_id !== myProfileId && row.last_read_at) setOtherReadAt(row.last_read_at);
    });
    ch.on('broadcast', { event: 'typing' }, () => {
      setTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 3500);
    });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      setOnline(Object.keys(state).some((k) => k !== myProfileId));
    });
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await ch.track({ online_at: new Date().toISOString() });
    });
    channelRef.current = ch;
    return () => { void supabase.removeChannel(ch); channelRef.current = null; };
  }, [id, myProfileId, markRead]);

  const onChangeText = (t: string) => {
    setText(t);
    if (Date.now() - lastTypingSent.current > 2000 && channelRef.current) {
      lastTypingSent.current = Date.now();
      void channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { at: Date.now() } });
    }
  };

  const sendText = async (body: string, existing?: Local) => {
    const clientId = existing?.clientId ?? newClientId();
    const optimistic: Local = existing ?? { id: `local-${clientId}`, conversationId: id, senderProfileId: myProfileId, kind: 'text', body, mediaUrl: null, clientId, createdAt: new Date().toISOString(), isMine: true };
    setExtra((p) => [{ ...optimistic, status: 'sending' }, ...p.filter((m) => m.clientId !== clientId)]);
    try {
      const saved = await api.post<MessageItem>(`/conversations/${id}/messages`, { clientId, kind: 'text', body });
      setExtra((p) => [saved, ...p.filter((m) => m.clientId !== clientId)]);
      haptic.tap();
      void qc.invalidateQueries({ queryKey: keys.conversations });
    } catch (e) {
      setExtra((p) => p.map((m) => (m.clientId === clientId ? { ...m, status: 'failed' } : m)));
      Alert.alert('Message not sent', errorMessage(e));
    }
  };

  const sendImage = async (source: 'library' | 'camera') => {
    const asset = await pickImage(source);
    if (!asset) return;
    const clientId = newClientId();
    setExtra((p) => [{ id: `local-${clientId}`, conversationId: id, senderProfileId: myProfileId, kind: 'image', body: null, mediaUrl: null, localUri: asset.uri, clientId, createdAt: new Date().toISOString(), isMine: true, status: 'sending' }, ...p]);
    try {
      const { path } = await uploadAsset('chat', asset, id);
      const saved = await api.post<MessageItem>(`/conversations/${id}/messages`, { clientId, kind: 'image', mediaPath: path });
      setExtra((p) => [saved, ...p.filter((m) => m.clientId !== clientId)]);
    } catch (e) {
      setExtra((p) => p.filter((m) => m.clientId !== clientId));
      Alert.alert('Photo not sent', errorMessage(e));
    }
  };

  const other = conv.data?.other;
  const more = () => {
    const opts = [conv.data?.muted ? 'Unmute' : 'Mute', conv.data?.archived ? 'Unarchive' : 'Archive', 'View profile', 'Report or block', 'Cancel'];
    const act = async (i: number) => {
      try {
        if (i === 0) await api.patch(`/conversations/${id}`, { muted: !conv.data?.muted });
        if (i === 1) { await api.patch(`/conversations/${id}`, { archived: !conv.data?.archived }); if (!conv.data?.archived) router.back(); }
        if (i === 2 && other) router.push(`/member/${other.id}` as Href);
        if (i === 3) setSafety(true);
        void conv.refetch(); void qc.invalidateQueries({ queryKey: keys.conversations });
      } catch (e) { Alert.alert('Something went wrong', errorMessage(e)); }
    };
    if (Platform.OS === 'ios') ActionSheetIOS.showActionSheetWithOptions({ options: opts, cancelButtonIndex: 4, destructiveButtonIndex: 3 }, act);
    else Alert.alert('Conversation', undefined, opts.slice(0, 4).map((label, i) => ({ text: label, onPress: () => void act(i) })).concat([{ text: 'Cancel', onPress: () => undefined }]));
  };

  const lastMineRead = messages.find((m) => m.isMine && !m.status);
  const seen = !!(lastMineRead && otherReadAt && otherReadAt >= lastMineRead.createdAt);
  const locked = conv.data?.isLocked;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.canvas }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{
        headerTitle: () => (
          <Pressable onPress={() => other && router.push(`/member/${other.id}` as Href)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityRole="button" accessibilityLabel={`${other?.displayName ?? 'Profile'}${online ? ', online' : ''}`}>
            <Avatar uri={other?.photoUrl} name={other?.displayName ?? '·'} size={32} blurred={other?.photoBlurred} />
            <View>
              <Text variant="label" style={{ color: colors.ink }}>{other?.displayName ?? ''}</Text>
              <Text variant="small">{typing ? 'typing…' : online ? 'online' : ' '}</Text>
            </View>
          </Pressable>
        ),
        headerRight: () => <Pressable onPress={more} accessibilityRole="button" accessibilityLabel="Conversation options" hitSlop={10}><Icon name="more" /></Pressable>,
      }} />
      {pages.isLoading ? <Loading /> : pages.error ? <View style={{ padding: space.lg }}><ErrorState message={errorMessage(pages.error)} onRetry={() => pages.refetch()} /></View> : (
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => m.clientId ?? m.id}
          contentContainerStyle={{ padding: space.lg, gap: 6 }}
          onEndReached={() => pages.hasNextPage && !pages.isFetchingNextPage && pages.fetchNextPage()}
          ListHeaderComponent={seen ? <Text variant="small" style={{ alignSelf: 'flex-end' }}>Seen</Text> : undefined}
          ListFooterComponent={<Notice>AI never reads or sends your messages. Be kind, and never share financial details or send money.</Notice>}
          renderItem={({ item }) => {
            if (item.kind === 'system') return <Text variant="small" style={{ alignSelf: 'center', marginVertical: 6 }}>{item.body}</Text>;
            const mine = item.isMine;
            return (
              <Pressable
                onPress={() => item.status === 'failed' && item.body && sendText(item.body, item)}
                onLongPress={() => !mine && setSafety(true)}
                accessibilityLabel={`${mine ? 'You' : other?.displayName ?? 'Them'}: ${item.kind === 'image' ? 'photo' : item.body}${item.status === 'failed' ? '. Failed to send, tap to retry' : ''}`}
                style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%' }}
              >
                <View style={{ backgroundColor: mine ? colors.burgundy600 : colors.surface, borderWidth: mine ? 0 : 1, borderColor: colors.line, borderRadius: radius.lg, padding: item.kind === 'image' ? 4 : space.md, opacity: item.status === 'sending' ? 0.6 : 1 }}>
                  {item.kind === 'image'
                    ? <Image source={{ uri: item.mediaUrl ?? item.localUri }} style={{ width: 220, height: 220, borderRadius: radius.md, backgroundColor: colors.surface2 }} accessibilityIgnoresInvertColors />
                    : <Text style={{ color: mine ? colors.white : colors.ink }}>{item.body}</Text>}
                </View>
                {item.status === 'failed' && <Text variant="small" style={{ color: colors.danger, textAlign: 'right' }}>Not sent · tap to retry</Text>}
              </Pressable>
            );
          }}
        />
      )}
      {locked ? (
        <View style={{ padding: space.lg }}><Notice tone="warning">This conversation is closed.</Notice></View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: space.md, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface }}>
          {me.data?.featureFlags.chat_images !== false && (
            <Pressable onPress={() => Alert.alert('Send a photo', undefined, [{ text: 'Camera', onPress: () => void sendImage('camera') }, { text: 'Photo library', onPress: () => void sendImage('library') }, { text: 'Cancel', style: 'cancel' }])} accessibilityRole="button" accessibilityLabel="Send a photo" style={{ padding: 10 }}>
              <Icon name="image" />
            </Pressable>
          )}
          <TextInput
            accessibilityLabel="Message"
            value={text}
            onChangeText={onChangeText}
            placeholder="Write a message…"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={4000}
            style={{ flex: 1, maxHeight: 120, minHeight: 44, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 10, fontFamily: fonts.body, fontSize: 15, color: colors.ink, backgroundColor: colors.canvas }}
          />
          <Pressable onPress={() => { const b = text.trim(); if (b) { setText(''); void sendText(b); } }} disabled={!text.trim()} accessibilityRole="button" accessibilityLabel="Send message" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.burgundy600, alignItems: 'center', justifyContent: 'center', opacity: text.trim() ? 1 : 0.5 }}>
            <Icon name="send" color={colors.white} size={18} />
          </Pressable>
        </View>
      )}
      {other && <SafetySheet visible={safety} onClose={() => setSafety(false)} profileId={other.id} name={other.displayName} onBlocked={() => router.replace('/messages')} />}
    </KeyboardAvoidingView>
  );
}
