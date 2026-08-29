-- P3.1 Connector Framework (provider-agnostic) + Email connector

create type public.connector_status as enum ('draft','connected','error','disabled');
create type public.connector_direction as enum ('inbound','outbound');
create type public.connector_event_status as enum ('received','normalized','routed','ignored','failed');

create table public.connector_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null,
  display_name text not null,
  status public.connector_status not null default 'draft',
  config jsonb not null default '{}'::jsonb,
  inbound_secret_hash text,
  inbound_secret_set_at timestamptz,
  credential_secret_name text,
  capabilities text[] not null default '{}',
  last_event_at timestamptz,
  last_error text,
  events_received integer not null default 0,
  leads_created integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index connector_connections_business_idx on public.connector_connections (business_id, provider);

grant select, insert, update, delete on public.connector_connections to authenticated;
grant all on public.connector_connections to service_role;
alter table public.connector_connections enable row level security;

create policy "connector_connections_member_read" on public.connector_connections
  for select to authenticated using (public.is_business_member(business_id));
create policy "connector_connections_manager_write" on public.connector_connections
  for all to authenticated
  using (public.is_business_manager(business_id))
  with check (public.is_business_manager(business_id));

create trigger trg_connector_connections_updated_at
  before update on public.connector_connections
  for each row execute function public.set_updated_at();

create table public.connector_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  connection_id uuid not null references public.connector_connections(id) on delete cascade,
  provider text not null,
  direction public.connector_direction not null default 'inbound',
  event_type text not null,
  external_id text,
  status public.connector_event_status not null default 'received',
  occurred_at timestamptz not null default now(),
  contact_name text,
  contact_email text,
  contact_phone text,
  subject text,
  body_preview text,
  payload jsonb not null default '{}'::jsonb,
  lead_id uuid references public.leads(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  routed_action text,
  error text,
  created_at timestamptz not null default now()
);

create unique index connector_events_dedupe_idx
  on public.connector_events (connection_id, external_id)
  where external_id is not null;
create index connector_events_business_idx
  on public.connector_events (business_id, occurred_at desc);

grant select on public.connector_events to authenticated;
grant all on public.connector_events to service_role;
alter table public.connector_events enable row level security;

create policy "connector_events_member_read" on public.connector_events
  for select to authenticated using (public.is_business_member(business_id));
