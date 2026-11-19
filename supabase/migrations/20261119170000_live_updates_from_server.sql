-- Live pings are now sent by the app server (Realtime REST broadcast) right after a successful save.
drop trigger if exists kv_room_changed on public.kv;
drop function if exists private.room_changed();
