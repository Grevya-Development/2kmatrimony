import * as React from 'react';
import { FlatList, View } from 'react-native';
import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import type { ProfileCard, SearchFilters, SmartSearchInterpretation } from '@2k/shared';
import { api, ApiClientError, errorMessage } from '@/lib/api';
import { activeFilterCount, filterChips, removeFilter, serializeFilters, usesAdvancedFilters } from '@/lib/filters';
import { useMe } from '@/hooks/queries';
import { colors, space } from '@/theme';
import { Button, Chip, EmptyState, ErrorState, Loading, Notice, OfflineBanner, SegmentedControl, Text, TextField } from '@/components/ui';
import { ProfileCardView } from '@/components/domain/ProfileCardView';
import { FilterSheet } from '@/components/domain/FilterSheet';
import { PrimaryAction, ShortlistButton, handleEntitlementError } from '@/components/domain/ProfileActions';

interface SearchPage { items: ProfileCard[]; total: number }
type Sort = 'relevance' | 'compatibility' | 'newest' | 'recently_active';

export default function Discover() {
  const me = useMe();
  const advancedAllowed = !!me.data?.plan.entitlements.advanced_filters;
  const [filters, setFilters] = React.useState<SearchFilters>({});
  const [softPreferences, setSoft] = React.useState<string[]>([]);
  const [sort, setSort] = React.useState<Sort>('relevance');
  const [sheet, setSheet] = React.useState(false);
  const [ask, setAsk] = React.useState('');
  const [interpretation, setInterpretation] = React.useState<SmartSearchInterpretation | null>(null);

  const search = useInfiniteQuery({
    queryKey: ['search', serializeFilters(filters), sort, softPreferences],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => api.request<SearchPage>('/search', { method: 'POST', body: { filters: serializeFilters(filters), softPreferences, sort, cursor: pageParam, limit: 20 } }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const cards = search.data?.pages.flatMap((p) => p.data.items) ?? [];
  const total = search.data?.pages[0]?.data.total;

  const smart = useMutation({
    mutationFn: (query: string) => api.post<SmartSearchInterpretation>('/search/smart', { query }),
    onSuccess: setInterpretation,
    onError: (e) => { handleEntitlementError(e); },
  });

  const apply = (f: SearchFilters, soft: string[] = []) => {
    const used = usesAdvancedFilters(f);
    if (used.length && !advancedAllowed) {
      handleEntitlementError(new ApiClientError(402, 'entitlement_required', 'Advanced filters are available on Plus and above.'));
      return;
    }
    setFilters(f);
    setSoft(soft);
  };

  const header = (
    <View style={{ gap: space.md, marginBottom: space.md }}>
      <View style={{ gap: 8 }}>
        <TextField label="Ask in your own words" value={ask} onChangeText={setAsk} placeholder="Career-oriented, values family, settling in Bengaluru…" returnKeyType="search" onSubmitEditing={() => ask.trim().length >= 3 && smart.mutate(ask.trim())} />
        <Button title="Interpret" variant="secondary" size="sm" loading={smart.isPending} disabled={ask.trim().length < 3} onPress={() => smart.mutate(ask.trim())} />
        {smart.error && !(smart.error instanceof ApiClientError && smart.error.code === 'entitlement_required') && (
          <ErrorState message={smart.error instanceof ApiClientError && smart.error.code === 'service_unconfigured' ? 'Smart search is unavailable right now — use filters instead.' : errorMessage(smart.error)} />
        )}
        {interpretation && (
          <View style={{ gap: 8, padding: space.md, borderRadius: 16, backgroundColor: colors.champagne50, borderWidth: 1, borderColor: colors.champagne200 }}>
            <Text variant="label">We understood: {interpretation.summary}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {filterChips(interpretation.filters).map((c) => (
                <Chip key={c.key} label={c.label} onRemove={() => setInterpretation({ ...interpretation, filters: removeFilter(interpretation.filters, c.key) })} />
              ))}
              {interpretation.softPreferences.map((s) => <Chip key={s} label={`~ ${s}`} onRemove={() => setInterpretation({ ...interpretation, softPreferences: interpretation.softPreferences.filter((x) => x !== s) })} />)}
            </View>
            {interpretation.clarifyingQuestions.map((q) => <Text key={q} variant="small">• {q}</Text>)}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Apply" size="sm" onPress={() => { apply(interpretation.filters, interpretation.softPreferences); setInterpretation(null); }} />
              <Button title="Edit in filters" size="sm" variant="secondary" onPress={() => { setFilters(interpretation.filters); setSoft(interpretation.softPreferences); setInterpretation(null); setSheet(true); }} />
            </View>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Button title={`Filters${activeFilterCount(filters) ? ` (${activeFilterCount(filters)})` : ''}`} variant="secondary" size="sm" onPress={() => setSheet(true)} />
        {activeFilterCount(filters) > 0 && <Button title="Clear" variant="ghost" size="sm" onPress={() => { setFilters({}); setSoft([]); }} />}
      </View>
      <SegmentedControl label="Sort" value={sort} onChange={setSort} options={[{ value: 'relevance', label: 'Relevant' }, { value: 'compatibility', label: 'Aligned' }, { value: 'recently_active', label: 'Active' }, { value: 'newest', label: 'New' }]} />
      {filterChips(filters).length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {filterChips(filters).map((c) => <Chip key={c.key} label={c.label} onRemove={() => setFilters(removeFilter(filters, c.key))} />)}
        </View>
      )}
      {typeof total === 'number' && total > 0 && <Text variant="small">{total} {total === 1 ? 'person' : 'people'} match</Text>}
      {search.error instanceof ApiClientError && search.error.code === 'entitlement_required' && <Notice tone="warning">{search.error.message}</Notice>}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <OfflineBanner />
      <FlatList
        data={cards}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 80 }}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.6}
        onEndReached={() => { if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage(); }}
        renderItem={({ item }) => <ProfileCardView card={item} compact actions={<><PrimaryAction card={item} size="sm" /><ShortlistButton card={item} /></>} />}
        ListEmptyComponent={search.isLoading ? <Loading /> : search.error ? <ErrorState message={errorMessage(search.error)} onRetry={() => search.refetch()} /> : <EmptyState title="No one matches these filters" description="Try widening your filters — compatibility still ranks the best fits first." />}
        ListFooterComponent={search.isFetchingNextPage ? <Loading /> : undefined}
        refreshing={search.isRefetching && !search.isFetchingNextPage}
        onRefresh={() => search.refetch()}
      />
      <FilterSheet visible={sheet} onClose={() => setSheet(false)} initial={filters} onApply={(f) => apply(f, softPreferences)} advancedAllowed={advancedAllowed} />
    </View>
  );
}
