
-- Service health checks table (rolling 90-day history)
CREATE TABLE IF NOT EXISTS public.service_checks (
  id         bigint generated always as identity primary key,
  service    text not null,
  status     text not null check (status in ('operational', 'degraded', 'down')),
  latency_ms integer,
  status_code integer,
  error_message text,
  checked_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_service_checks_service_time
  ON public.service_checks (service, checked_at desc);

-- Incidents table
CREATE TABLE IF NOT EXISTS public.incidents (
  id          bigint generated always as identity primary key,
  title       text not null,
  description text,
  severity    text not null default 'minor' check (severity in ('minor', 'major', 'critical')),
  status      text not null default 'investigating' check (status in ('investigating', 'identified', 'monitoring', 'resolved')),
  affected_services text[] default '{}',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  updated_at  timestamptz not null default now()
);

-- Enable RLS but allow public read access
ALTER TABLE public.service_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- Anyone can read status checks (public status page)
CREATE POLICY "Public read access for service_checks"
  ON public.service_checks FOR SELECT
  USING (true);

CREATE POLICY "Public read access for incidents"
  ON public.incidents FOR SELECT
  USING (true);

-- Only service_role can insert/update (the monitoring backend)
CREATE POLICY "Service role insert for service_checks"
  ON public.service_checks FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role insert for incidents"
  ON public.incidents FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role update for incidents"
  ON public.incidents FOR UPDATE
  USING (auth.role() = 'service_role');

-- Enable realtime for live updates on the status page
ALTER publication supabase_realtime ADD TABLE public.service_checks;
ALTER publication supabase_realtime ADD TABLE public.incidents;
;
