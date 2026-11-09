import * as React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { DNA_DIMENSIONS, DNA_DIMENSION_META, type DnaDimension } from '@2k/shared';
import { colors } from '@/theme';

export interface DnaPoint { dimension: DnaDimension; selfScore: number; partnerTarget: number | null }

/**
 * Radar view of self-declared Relationship DNA. Emerald = you, gold =
 * what you hope for in a partner. A visualization of your answers — not a diagnosis.
 */
export function DnaChart({ entries, size = 300 }: { entries: DnaPoint[]; size?: number }) {
  const map = new Map(entries.map((e) => [e.dimension, e]));
  const c = size / 2;
  const r = c - 44;
  const n = DNA_DIMENSIONS.length;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * r * (v / 100), c + Math.sin(a) * r * (v / 100)] as const;
  };
  const poly = (fn: (d: DnaDimension) => number | null) =>
    DNA_DIMENSIONS.map((d, i) => pt(i, fn(d) ?? 0).join(',')).join(' ');
  const summary = entries.map((e) => `${DNA_DIMENSION_META[e.dimension].label} ${e.selfScore}`).join(', ');
  return (
    <View accessible accessibilityLabel={`Relationship DNA chart. ${summary}`} style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {[25, 50, 75, 100].map((g) => <Polygon key={g} points={DNA_DIMENSIONS.map((_, i) => pt(i, g).join(',')).join(' ')} fill="none" stroke={colors.line} strokeWidth={1} />)}
        {DNA_DIMENSIONS.map((d, i) => { const [x, y] = pt(i, 100); return <Line key={d} x1={c} y1={c} x2={x} y2={y} stroke={colors.line} strokeWidth={1} />; })}
        <Polygon points={poly((d) => map.get(d)?.partnerTarget ?? map.get(d)?.selfScore ?? 0)} fill={`${colors.gold200}66`} stroke={colors.gold600} strokeWidth={1.5} strokeDasharray="4 3" />
        <Polygon points={poly((d) => map.get(d)?.selfScore ?? 0)} fill={`${colors.emerald500}26`} stroke={colors.emerald600} strokeWidth={2} />
        {DNA_DIMENSIONS.map((d, i) => { const e = map.get(d); if (!e) return null; const [x, y] = pt(i, e.selfScore); return <Circle key={d} cx={x} cy={y} r={3.5} fill={colors.emerald600} />; })}
        {DNA_DIMENSIONS.map((d, i) => {
          const [x, y] = pt(i, 122);
          const label = DNA_DIMENSION_META[d].label.split(' ')[0] ?? '';
          return <SvgText key={d} x={x} y={y} fontSize={10} fill={colors.muted} textAnchor="middle" alignmentBaseline="middle">{label}</SvgText>;
        })}
      </Svg>
    </View>
  );
}
