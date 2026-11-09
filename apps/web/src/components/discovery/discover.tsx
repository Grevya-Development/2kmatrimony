'use client';
import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, Sparkles, Users } from 'lucide-react';
import { searchFiltersSchema, type ProfileCard, type SearchFilters } from '@2k/shared';
import { Button, Dialog, DialogContent, EmptyState, ErrorState, NativeSelect, PageHeader, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { useMe } from '@/components/shell/me-context';
import { ProfileCardView } from '@/components/profile/profile-card';
import { SmartSearch } from '@/components/ai/smart-search';
import { apiRaw, ApiClientError } from '@/lib/api';
import { ProfileActions } from './profile-actions';
import { FiltersPanel } from './filters-panel';
import { showApiError } from './hooks';

type Sort = 'relevance' | 'compatibility' | 'newest' | 'recently_active';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'relevance', label: 'Most relevant' },
  { value: 'compatibility', label: 'Highest alignment' },
  { value: 'recently_active', label: 'Recently active' },
  { value: 'newest', label: 'Newest members' },
];

function readFilters(raw: string | null): SearchFilters {
  if (!raw) return {};
  try { const r = searchFiltersSchema.safeParse(JSON.parse(raw)); return r.success ? r.data : {}; } catch { return {}; }
}
const activeCount = (f: SearchFilters) => Object.values(f).filter((v) => v !== undefined && !(Array.isArray(v) && v.length === 0)).length;

export function Discover() {
  const { me } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const applied = React.useMemo(() => readFilters(params.get('f')), [params]);
  const sort = (params.get('sort') as Sort) || 'relevance';
  const soft = React.useMemo(() => params.getAll('soft').slice(0, 10), [params]);
  const [mode, setMode] = React.useState(params.get('mode') === 'ask' ? 'ask' : 'browse');
  const [draft, setDraft] = React.useState<SearchFilters>(applied);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [items, setItems] = React.useState<ProfileCard[]>([]);
  const [total, setTotal] = React.useState(0);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [upgrade, setUpgrade] = React.useState<string | null>(null);
  const advanced = me.plan.entitlements.advanced_filters;
  const profileActive = me.profile?.status === 'active';

  React.useEffect(() => setDraft(applied), [applied]);

  const pushUrl = (filters: SearchFilters, nextSort: Sort, softPrefs: string[] = []) => {
    const q = new URLSearchParams();
    if (activeCount(filters)) q.set('f', JSON.stringify(filters));
    if (nextSort !== 'relevance') q.set('sort', nextSort);
    for (const s of softPrefs) q.append('soft', s);
    router.replace(`${pathname}${q.size ? `?${q}` : ''}`, { scroll: false });
  };

  const fetchPage = React.useCallback(async (cursor?: string) => {
    return apiRaw<{ items: ProfileCard[]; total: number }>('/search', { body: { filters: applied, sort, cursor, limit: 18, softPreferences: soft } });
  }, [applied, sort, soft]);

  React.useEffect(() => {
    if (!profileActive) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setError(null); setUpgrade(null);
    fetchPage()
      .then((r) => { if (cancelled) return; setItems(r.data.items); setTotal(r.data.total); setNextCursor(r.nextCursor ?? null); })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiClientError && e.code === 'entitlement_required') setUpgrade(e.message);
        else setError(e instanceof ApiClientError ? e.message : 'Could not load results.');
        setItems([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [fetchPage, profileActive]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const r = await fetchPage(nextCursor);
      setItems((cur) => [...cur, ...r.data.items.filter((i) => !cur.some((c) => c.id === i.id))]);
      setNextCursor(r.nextCursor ?? null);
    } catch (e) { showApiError(e); } finally { setLoadingMore(false); }
  };

  const apply = () => { setFiltersOpen(false); pushUrl(draft, sort); };
  const reset = () => { setDraft({}); setFiltersOpen(false); pushUrl({}, sort); };
  const panel = <FiltersPanel value={draft} onChange={setDraft} onApply={apply} onReset={reset} advanced={advanced} />;

  return (
    <div>
      <PageHeader eyebrow="Discover" title="Explore at your own pace" description="Browse with filters, or describe the person you hope to meet in your own words. Results are ranked by mutual alignment." />
      <Tabs value={mode} onValueChange={setMode}>
        <TabsList aria-label="Discovery mode">
          <TabsTrigger value="browse"><span className="inline-flex items-center gap-2"><Users className="h-4 w-4" />Browse</span></TabsTrigger>
          {me.featureFlags.smart_search !== false && <TabsTrigger value="ask"><span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4" />Ask in your words</span></TabsTrigger>}
        </TabsList>

        <TabsContent value="ask">
          <div className="max-w-3xl">
            <SmartSearch onApply={(filters, softPrefs) => { setMode('browse'); pushUrl(filters, 'relevance', softPrefs); }} />
          </div>
        </TabsContent>

        <TabsContent value="browse">
          <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
            <aside className="hidden lg:block" aria-label="Filters">
              <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-2">{panel}</div>
            </aside>
            <section aria-live="polite">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">{loading ? 'Searching…' : `${total} ${total === 1 ? 'profile' : 'profiles'}`}{soft.length > 0 && ' · ranked by what you described'}</p>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)}><SlidersHorizontal />Filters{activeCount(applied) ? ` (${activeCount(applied)})` : ''}</Button>
                  <label className="sr-only" htmlFor="sort">Sort by</label>
                  <NativeSelect id="sort" className="h-9 w-48 text-sm" value={sort} onChange={(e) => pushUrl(applied, e.target.value as Sort, soft)}>
                    {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </NativeSelect>
                </div>
              </div>

              {!profileActive ? (
                <EmptyState icon={<Sparkles />} title="Finish your profile to start discovering" description="Discovery opens once your profile is complete, so others can see you too." action={<Button onClick={() => router.push('/onboarding')}>Continue setting up</Button>} />
              ) : loading ? (
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[4/6]" />)}</div>
              ) : upgrade ? (
                <EmptyState icon={<SlidersHorizontal />} title="You’ve reached today’s search limit" description="To keep the community safe we cap searches per day. Please try again tomorrow." action={<Button variant="secondary" onClick={reset}>Reset filters</Button>} />
              ) : error ? (
                <ErrorState message={error} onRetry={() => pushUrl(applied, sort, soft)} />
              ) : items.length === 0 ? (
                <EmptyState icon={<Users />} title="No profiles match these filters" description="Try widening the age range or location, or removing a filter or two." action={<Button variant="secondary" onClick={reset}>Reset filters</Button>} />
              ) : (
                <>
                  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((card) => (
                      <ProfileCardView key={card.id} card={card} href={`/app/profile/${card.id}?source=discover`}
                        actions={<ProfileActions size="sm" target={{ id: card.id, displayName: card.displayName, relationship: card.relationship }} onRemoved={() => setItems((cur) => cur.filter((c) => c.id !== card.id))} />} />
                    ))}
                  </div>
                  {nextCursor && <div className="mt-10 flex justify-center"><Button variant="secondary" loading={loadingMore} onClick={loadMore}>Show more</Button></div>}
                </>
              )}
            </section>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent side="right" title="Filters">{panel}</DialogContent>
      </Dialog>
    </div>
  );
}
