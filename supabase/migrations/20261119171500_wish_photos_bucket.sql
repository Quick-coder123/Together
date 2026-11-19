-- Wish-list photos: a public bucket (files have random names); only the server (via the wish-photo
-- edge function with the service key) can upload. No policies = no direct uploads with the public key.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wish', 'wish', true, 400000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
