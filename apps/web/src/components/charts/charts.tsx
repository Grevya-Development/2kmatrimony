'use client';
import * as React from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/** Chart palette drawn from the design tokens (burgundy, champagne, ink, success, info). */
export const CHART_COLORS = ['#7a2e3c', '#a8875a', '#4a4540', '#3f6b4f', '#3b5a7a', '#d2b583'];

const axis = { stroke: '#77706a', fontSize: 11, tickLine: false, axisLine: false } as const;
const shortDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

interface SeriesDef { key: string; label: string; color?: string }

function ChartTooltip({ format }: { format?: (n: number) => string }) {
  return (
    <Tooltip
      contentStyle={{ borderRadius: 12, border: '1px solid #e8e1d6', background: '#fffdf9', fontSize: 12, boxShadow: '0 12px 32px rgb(31 29 27 / 0.08)' }}
      labelFormatter={(l) => (typeof l === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(l) ? shortDay(l) : String(l))}
      formatter={(v) => (format && typeof v === 'number' ? format(v) : String(v))}
    />
  );
}

/** Accessible wrapper: charts get a text summary for screen readers. */
function Frame({ label, summary, height, children }: { label: string; summary?: string; height: number; children: React.ReactElement }) {
  return (
    <figure aria-label={label} className="w-full">
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
      {summary && <figcaption className="sr-only">{summary}</figcaption>}
    </figure>
  );
}

export function TimeAreaChart({ data, series, label, height = 220, format, xKey = 'day' }: { data: Record<string, unknown>[]; series: SeriesDef[]; label: string; height?: number; format?: (n: number) => string; xKey?: string }) {
  const summary = series.map((s) => `${s.label}: total ${data.reduce((a, r) => a + Number(r[s.key] ?? 0), 0)}`).join('; ');
  return (
    <Frame label={label} summary={summary} height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.22} />
              <stop offset="100%" stopColor={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="#e8e1d6" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} {...axis} tickFormatter={(v: string) => (/^\d{4}-/.test(v) ? shortDay(v) : v)} minTickGap={24} />
        <YAxis {...axis} width={48} tickFormatter={(v: number) => (format ? format(v) : new Intl.NumberFormat('en-IN', { notation: 'compact' }).format(v))} />
        <ChartTooltip format={format} />
        {series.map((s, i) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={1.75} fill={`url(#fill-${s.key})`} />
        ))}
      </AreaChart>
    </Frame>
  );
}

export function SimpleBarChart({ data, xKey, series, label, height = 220, format, layout = 'horizontal' }: { data: Record<string, unknown>[]; xKey: string; series: SeriesDef[]; label: string; height?: number; format?: (n: number) => string; layout?: 'horizontal' | 'vertical' }) {
  const summary = data.map((r) => `${r[xKey]}: ${series.map((s) => r[s.key]).join(', ')}`).join('; ');
  return (
    <Frame label={label} summary={summary} height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 8, right: 8, left: layout === 'vertical' ? 40 : -12, bottom: 0 }}>
        <CartesianGrid stroke="#e8e1d6" strokeDasharray="3 3" vertical={layout === 'vertical'} horizontal={layout !== 'vertical'} />
        {layout === 'vertical' ? (
          <>
            <XAxis type="number" {...axis} />
            <YAxis type="category" dataKey={xKey} {...axis} width={110} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} {...axis} />
            <YAxis {...axis} width={40} />
          </>
        )}
        <ChartTooltip format={format} />
        {series.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]} radius={4} maxBarSize={36} />)}
      </BarChart>
    </Frame>
  );
}

export function Sparkline({ data, dataKey, color = CHART_COLORS[0] }: { data: Record<string, unknown>[]; dataKey: string; color?: string }) {
  return (
    <div className="h-10 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}><Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} /></LineChart>
      </ResponsiveContainer>
    </div>
  );
}
