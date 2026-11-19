-- Everything worth keeping, for the daily off-site backup (short-lived counters and claims are skipped).
create or replace function public.kv_dump(p_secret text) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.ok(p_secret);
  return (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'value', value) order by key), '[]'::jsonb)
          from public.kv where expires_at is null);
end $$;

-- Restore from a backup (rows: [{key, value}]); used only by hand if something goes wrong.
create or replace function public.kv_restore(p_secret text, p_rows jsonb) returns int language plpgsql security definer set search_path = '' as $$
declare r jsonb; n int := 0;
begin
  perform private.ok(p_secret);
  for r in select * from jsonb_array_elements(p_rows) loop
    insert into public.kv (key, value) values (r->>'key', r->'value')
    on conflict (key) do update set value = excluded.value, ver = public.kv.ver + 1, expires_at = null, updated_at = now();
    n := n + 1;
  end loop;
  return n;
end $$;
