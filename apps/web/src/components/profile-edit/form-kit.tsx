'use client';
import * as React from 'react';
import { z, type ZodType } from 'zod';
import { toast } from 'sonner';
import type { CompletionReport, CreatedFor, Option } from '@2k/shared';
import { api, ApiClientError } from '@/lib/api';
import { Button, Field, NativeSelect } from '@/components/ui';

/** Copy that adapts when a parent/relative manages the profile. */
export function subjectCopy(createdFor: CreatedFor | null | undefined) {
  const self = !createdFor || createdFor === 'self';
  return { self, your: self ? 'your' : 'their', Your: self ? 'Your' : 'Their', you: self ? 'you' : 'they', You: self ? 'You' : 'They', are: self ? 'are' : 'are' };
}
export type Subject = ReturnType<typeof subjectCopy>;

export interface SectionFormProps<T> {
  initial: Partial<T>;
  subject: Subject;
  submitLabel?: string;
  onSaved?: (completion: CompletionReport | null) => void;
  onSkip?: () => void;
}

/** Validates with a shared Zod schema, submits to the API, maps field errors. */
export function useSectionSave<S extends ZodType>(schema: S, path: string, method: 'PUT' | 'POST' = 'PUT') {
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const save = React.useCallback(async (value: unknown): Promise<{ ok: boolean; completion: CompletionReport | null }> => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error) as { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> };
      setErrors(Object.fromEntries(Object.entries(flat.fieldErrors).map(([k, v]) => [k, v?.[0] ?? 'Invalid'])));
      toast.error(parsed.error.issues[0]?.message ?? 'Please check the highlighted fields.');
      return { ok: false, completion: null };
    }
    setErrors({});
    setSaving(true);
    try {
      const data = await api<{ completion?: CompletionReport } | CompletionReport>(path, { method, body: parsed.data });
      const completion = data && 'completion' in data ? data.completion ?? null : (data as CompletionReport | null);
      return { ok: true, completion };
    } catch (e) {
      const err = e as ApiClientError;
      const fe = (err.details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors;
      if (fe) setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v[0] ?? 'Invalid'])));
      toast.error(err.message);
      return { ok: false, completion: null };
    } finally {
      setSaving(false);
    }
  }, [schema, path, method]);
  return { errors, saving, save };
}

export function SelectField<T extends string>({ id, label, value, onChange, options, error, optional, hint, placeholder = 'Select…' }: {
  id: string; label: string; value: T | null | undefined; onChange: (v: T | null) => void; options: Option<T>[]; error?: string; optional?: boolean; hint?: string; placeholder?: string;
}) {
  return (
    <Field label={label} htmlFor={id} error={error} optional={optional} hint={hint}>
      <NativeSelect value={value ?? ''} onChange={(e) => onChange((e.target.value || null) as T | null)}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </NativeSelect>
    </Field>
  );
}

export function FormActions({ saving, submitLabel = 'Save', onSkip }: { saving: boolean; submitLabel?: string; onSkip?: () => void }) {
  return (
    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
      {onSkip ? <Button type="button" variant="ghost" onClick={onSkip}>Skip for now</Button> : <span />}
      <Button type="submit" size="lg" loading={saving}>{submitLabel}</Button>
    </div>
  );
}

export function FormSection({ title, description, children }: { title?: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-5">
      {title && <legend className="mb-1 font-serif text-2xl text-ink">{title}</legend>}
      {description && <p className="-mt-3 text-sm text-muted">{description}</p>}
      {children}
    </fieldset>
  );
}

export const toOptions = (values: readonly string[]): Option[] => values.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ') }));

export const intOrNull = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
};
