'use client';
import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, MessagesSquare } from 'lucide-react';
import type { ConnectionOverview } from '@2k/shared';
import { relativeTime } from '@2k/shared';
import { Avatar, Badge, Button, ErrorState, Notice, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { api, ApiClientError } from '@/lib/api';
import { InsightPanel } from './insight-panel';
import { Journal } from './journal';
import { Meetings } from './meetings';
import { VisionBoard } from './vision-board';

export function ConnectionView({ connectionId }: { connectionId: string }) {
  const [data, setData] = React.useState<ConnectionOverview | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api<ConnectionOverview>(`/connections/${connectionId}`).then(setData).catch((e) => setError(e instanceof ApiClientError ? e.message : 'Could not load this connection.'));
  }, [connectionId]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;
  const name = data.other.displayName;
  const first = name.split(' ')[0] ?? name;
  const active = data.status === 'active';
  const ex = data.explanation;

  return (
    <div className="space-y-8">
      <Link href="/app/connections" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />All connections</Link>
      <header className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6 shadow-soft sm:flex-row sm:items-center">
        <Avatar src={data.other.photoUrl} name={name} blurred={data.other.photoBlurred} className="h-20 w-20" />
        <div className="flex-1">
          <h1 className="font-serif text-4xl leading-tight">{name}</h1>
          <p className="text-ink-2">{[data.other.age && `${data.other.age}`, data.other.city, data.other.profession].filter(Boolean).join(' · ')}</p>
          <p className="mt-1 text-sm text-muted">Connected {relativeTime(data.createdAt)} {!active && <Badge className="ml-1">Closed</Badge>}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="secondary"><Link href={`/app/profile/${data.other.id}`}>View profile</Link></Button>
          {data.conversationId && active && <Button asChild><Link href={`/app/messages/${data.conversationId}`}><MessagesSquare />Message</Link></Button>}
        </div>
      </header>
      {!active && <Notice tone="warning">This connection is closed. You can still read what was shared, but new plans and insights are paused.</Notice>}

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto scrollbar-none">
          <TabsList className="w-max">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="gap">Gap analysis</TabsTrigger>
            <TabsTrigger value="meet">Before you meet</TabsTrigger>
            {data.features.visionBoard && <TabsTrigger value="vision">Vision board</TabsTrigger>}
            {data.features.journal && <TabsTrigger value="journal">Journal</TabsTrigger>}
            <TabsTrigger value="meetings">Meetings</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview">
          {ex ? (
            <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
              <div className="rounded-2xl bg-surface-2 p-6 text-center">
                <p className="font-serif text-6xl text-emerald-600">{ex.compatibility.mutual}<span className="text-2xl">%</span></p>
                <p className="mt-1 font-serif text-xl">{ex.compatibility.label}</p>
                <p className="mt-2 text-xs text-muted">{ex.disclaimer}</p>
              </div>
              <div className="space-y-4">
                <p className="text-[1.02rem] text-ink-2">{ex.headline}</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {ex.dimensions.filter((d) => d.score !== null).map((d) => (
                    <li key={d.key} className="rounded-xl border border-line p-3">
                      <div className="flex justify-between text-sm"><span className="font-medium">{d.label}</span><span className="tabular-nums text-muted">{d.score}%</span></div>
                      <p className="mt-1 text-xs text-muted">{d.note}</p>
                    </li>
                  ))}
                </ul>
                {ex.sharedInterests.length > 0 && <div className="flex flex-wrap gap-2">{ex.sharedInterests.map((i) => <Badge key={i} tone="outline">{i}</Badge>)}</div>}
              </div>
            </div>
          ) : <p className="text-sm text-muted">Compatibility details are not available.</p>}
        </TabsContent>
        <TabsContent value="gap"><InsightPanel connectionId={connectionId} kind="gap_analysis" entitled={data.features.gapAnalysis} active={active} /></TabsContent>
        <TabsContent value="meet"><InsightPanel connectionId={connectionId} kind="before_you_meet" entitled={data.features.beforeYouMeet} active={active} /></TabsContent>
        {data.features.visionBoard && <TabsContent value="vision"><VisionBoard connectionId={connectionId} otherName={first} active={active} /></TabsContent>}
        {data.features.journal && <TabsContent value="journal"><Journal connectionId={connectionId} /></TabsContent>}
        <TabsContent value="meetings"><Meetings connectionId={connectionId} active={active} /></TabsContent>
      </Tabs>
    </div>
  );
}
