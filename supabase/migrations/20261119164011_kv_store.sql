-- Storage for «Хамелеончики»: one key/value table (rooms, accounts, push subscriptions, counters).
-- Only the app server can use it: every function needs the server secret; the table itself is closed (RLS, no policies).
-- The secret lives in private.config (name = 'secret') and in the Vercel env var SB_SECRET.
create schema if not exists private;
create table private.config (name text primary key, value text not null);
revoke all on schema private from public, anon, authenticated;

create table public.kv (
  key text primary key,
  value jsonb not null,
  ver bigint not null default 1,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
create index kv_expires_idx on public.kv (expires_at) where expires_at is not null;
alter table public.kv enable row level security;
revoke all on public.kv from anon, authenticated;

create or replace function private.ok(p_secret text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_secret is null or p_secret <> (select value from private.config where name = 'secret') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

create or replace function public.kv_get(p_secret text, p_key text) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.ok(p_secret);
  return (select value from public.kv where key = p_key and (expires_at is null or expires_at > now()));
end $$;

create or replace function public.kv_getv(p_secret text, p_key text) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.ok(p_secret);
  return (select jsonb_build_object('value', value, 'ver', ver) from public.kv where key = p_key and (expires_at is null or expires_at > now()));
end $$;

create or replace function public.kv_set(p_secret text, p_key text, p_value jsonb, p_ttl int default null) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.ok(p_secret);
  insert into public.kv (key, value, expires_at) values (p_key, p_value, case when p_ttl is null then null else now() + make_interval(secs => p_ttl) end)
  on conflict (key) do update set value = excluded.value, ver = public.kv.ver + 1, expires_at = excluded.expires_at, updated_at = now();
end $$;

create or replace function public.kv_setnx(p_secret text, p_key text, p_value jsonb, p_ttl int default null) returns boolean language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform private.ok(p_secret);
  insert into public.kv (key, value, expires_at) values (p_key, p_value, case when p_ttl is null then null else now() + make_interval(secs => p_ttl) end)
  on conflict (key) do update set value = excluded.value, ver = public.kv.ver + 1, expires_at = excluded.expires_at, updated_at = now()
    where public.kv.expires_at is not null and public.kv.expires_at <= now();
  get diagnostics n = row_count;
  return n > 0;
end $$;

create or replace function public.kv_cas(p_secret text, p_key text, p_value jsonb, p_ver bigint) returns bigint language plpgsql security definer set search_path = '' as $$
declare v bigint;
begin
  perform private.ok(p_secret);
  if p_ver = 0 then
    insert into public.kv (key, value) values (p_key, p_value) on conflict (key) do nothing returning ver into v;
  else
    update public.kv set value = p_value, ver = ver + 1, updated_at = now() where key = p_key and ver = p_ver returning ver into v;
  end if;
  return v; -- null = conflict
end $$;

create or replace function public.kv_del(p_secret text, p_key text) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.ok(p_secret);
  delete from public.kv where key = p_key;
end $$;

create or replace function public.kv_incr(p_secret text, p_key text, p_ttl int default null) returns bigint language plpgsql security definer set search_path = '' as $$
declare n bigint;
begin
  perform private.ok(p_secret);
  delete from public.kv where key = p_key and expires_at is not null and expires_at <= now();
  insert into public.kv (key, value, expires_at) values (p_key, '1'::jsonb, case when p_ttl is null then null else now() + make_interval(secs => p_ttl) end)
  on conflict (key) do update set value = to_jsonb(coalesce((public.kv.value #>> '{}')::bigint, 0) + 1), ver = public.kv.ver + 1, updated_at = now()
  returning (value #>> '{}')::bigint into n;
  return n;
end $$;

create or replace function public.kv_sadd(p_secret text, p_key text, p_member text) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.ok(p_secret);
  insert into public.kv (key, value) values (p_key, jsonb_build_array(p_member))
  on conflict (key) do update set value = case when public.kv.value ? p_member then public.kv.value else public.kv.value || jsonb_build_array(p_member) end, updated_at = now();
end $$;
create or replace function public.kv_srem(p_secret text, p_key text, p_member text) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.ok(p_secret);
  update public.kv set value = (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements_text(value) x where x <> p_member), updated_at = now() where key = p_key;
end $$;

create or replace function public.kv_import(p_secret text, p_rows jsonb) returns int language plpgsql security definer set search_path = '' as $$
declare r jsonb; n int := 0;
begin
  perform private.ok(p_secret);
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public.kv (key, value, expires_at) values (r->>'key', r->'value', case when (r->>'ttl') is null then null else now() + make_interval(secs => (r->>'ttl')::int) end)
    on conflict (key) do update set value = excluded.value, ver = public.kv.ver + 1, expires_at = excluded.expires_at, updated_at = now();
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.kv_gc(p_secret text) returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform private.ok(p_secret);
  delete from public.kv where expires_at is not null and expires_at < now() - interval '1 hour';
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function private.ok(text) from public, anon, authenticated;
