'use client';
import * as React from 'react';
import { ChipGroup, Slider, Switch } from '@/components/ui';

export interface DnaValue {
  selfScore: number;
  partnerTarget: number | null;
  importance: number;
  flexible: boolean;
}

const IMPORTANCE = [
  { value: '1', label: 'Barely' }, { value: '2', label: 'A little' }, { value: '3', label: 'Somewhat' }, { value: '4', label: 'A lot' }, { value: '5', label: 'Essential' },
];

/** One Relationship DNA spectrum: self position, partner position, importance, flexibility. */
export function DnaScaleInput({ id, left, right, value, onChange, selfLabel = 'Where do you sit?', partnerLabel = 'What about your partner?' }: {
  id: string; left: string; right: string; value: DnaValue; onChange: (v: DnaValue) => void; selfLabel?: string; partnerLabel?: string;
}) {
  const specific = value.partnerTarget !== null;
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-sm font-medium text-ink-2" id={`${id}-self`}>{selfLabel}</p>
        <Slider aria-labelledby={`${id}-self`} min={0} max={100} step={1} value={[value.selfScore]} onValueChange={([s]) => onChange({ ...value, selfScore: s ?? 50 })} thumbLabels={[`${selfLabel} ${left} to ${right}`]} />
        <div className="flex justify-between gap-6 text-sm text-muted"><span className="max-w-[45%]">{left}</span><span className="max-w-[45%] text-right">{right}</span></div>
      </div>
      <div className="space-y-3">
        <p className="text-sm font-medium text-ink-2">{partnerLabel}</p>
        <ChipGroup label={partnerLabel} options={[{ value: 'similar', label: 'Similar to me' }, { value: 'specific', label: 'Somewhere specific' }]}
          value={[specific ? 'specific' : 'similar']} onChange={([x]) => onChange({ ...value, partnerTarget: x === 'specific' ? value.partnerTarget ?? value.selfScore : null })} />
        {specific && (
          <div className="space-y-2 rounded-xl bg-champagne-50 p-4">
            <Slider min={0} max={100} step={1} value={[value.partnerTarget ?? 50]} onValueChange={([s]) => onChange({ ...value, partnerTarget: s ?? 50 })} thumbLabels={['Partner position']} />
            <div className="flex justify-between gap-6 text-xs text-muted"><span>{left}</span><span className="text-right">{right}</span></div>
          </div>
        )}
      </div>
      <div className="space-y-3">
        <p className="text-sm font-medium text-ink-2">How much does this matter?</p>
        <ChipGroup label="Importance" options={IMPORTANCE} value={[String(value.importance)]} onChange={([x]) => onChange({ ...value, importance: Number(x ?? 3) })} />
      </div>
      <label className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3 text-sm text-ink-2">
        <span>Flexible — happy to meet someone a bit different here</span>
        <Switch checked={value.flexible} onCheckedChange={(on) => onChange({ ...value, flexible: on })} aria-label="Flexible on this dimension" />
      </label>
    </div>
  );
}
