-- 0501 RETENTION (Workstream E): allow export requests to be marked expired once
-- their download artefact is deleted (7-day retention, see docs/DATABASE.md).
alter table public.data_requests drop constraint if exists data_requests_status_check;
alter table public.data_requests add constraint data_requests_status_check
  check (status in ('pending', 'processing', 'completed', 'cancelled', 'failed', 'expired'));
create index if not exists verifications_retention_idx on public.verifications (status, reviewed_at) where cardinality(document_paths) > 0;
create index if not exists ai_usage_logs_retention_idx on public.ai_usage_logs (created_at);
