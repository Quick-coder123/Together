// Uploads a wish-list photo to the public "wish" bucket and returns its URL.
// Called only by the app server: the body must carry the server secret (checked by the kv_get function).
// Deployed with verify_jwt = false (it does its own check).
import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  let b: { secret?: string; data?: string; type?: string };
  try { b = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const { error: authErr } = await sb.rpc('kv_get', { p_secret: b.secret ?? '', p_key: '-' });
  if (authErr) return json({ error: 'forbidden' }, 403);
  const ext = TYPES[b.type ?? ''];
  if (!ext || typeof b.data !== 'string') return json({ error: 'bad image' }, 400);
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(b.data), (c) => c.charCodeAt(0)); } catch { return json({ error: 'bad base64' }, 400); }
  if (bytes.length < 100 || bytes.length > 400000) return json({ error: 'size' }, 400);
  const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('wish').upload(path, bytes, { contentType: b.type, cacheControl: '31536000', upsert: false });
  if (error) return json({ error: error.message }, 500);
  return json({ url: sb.storage.from('wish').getPublicUrl(path).data.publicUrl });
});
