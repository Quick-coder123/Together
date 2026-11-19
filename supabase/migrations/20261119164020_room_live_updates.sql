-- When a pair's data changes, ping both phones (Realtime broadcast). The topic contains the pair's
-- random live token (state.rt), and the message holds only the new version number — no data.
create or replace function private.room_changed() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.key like 'room:%' and coalesce(new.value->>'rt', '') <> '' then
    perform realtime.send(jsonb_build_object('rev', new.value->'rev', 'ver', new.ver), 'changed', 'room-' || (new.value->>'rt'), false);
  end if;
  return null;
end $$;
create trigger kv_room_changed after insert or update on public.kv for each row execute function private.room_changed();
revoke all on function private.room_changed() from public, anon, authenticated;
