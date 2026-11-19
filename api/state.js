import { applyAction, newRoom, viewFor, ActionError, isDate } from '../lib/core.js';
import { notifyAfterAction } from './_notify.js';

import { configured, loadRoom as load, createRoom as createUnique, updateRoom } from './_db.js';
import { randomBytes } from 'node:crypto';
const liveToken = () => randomBytes(12).toString('base64url'); // topic of the pair's live-update channel

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
const cleanId = (m) => String(m || '').slice(0, 40);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export async function GET(request) {
  if (!configured()) return json({ error: 'not_configured' }, 503);
  const q = new URL(request.url).searchParams;
  const code = cleanCode(q.get('code'));
  const mid = cleanId(q.get('member'));
  const today = isDate(q.get('today')) ? q.get('today') : null;
  if (code.length !== 6) return json({ error: 'Невірний код' }, 400);
  const state = await load(code);
  if (!state) return json({ error: 'Пару не знайдено' }, 404);
  // Sign-in on another device / home-screen app: show who is in the pair, so the person can pick themselves.
  // Profiles protected by a login don't reveal their id: they are opened only with the password.
  if (q.get('peek')) return json({ code, members: Object.entries(state.members).map(([id, m], slot) => ({ slot, id: m.login ? null : id, name: m.name, avatar: m.avatar || null, login: !!m.login })) });
  if (!state.members[mid]) return json({ error: 'not_member' }, 403);
  if (!state.rt) { const rt = liveToken(); await updateRoom(code, (st) => (st && !st.rt ? { next: { ...st, rt } } : null)); state.rt = (await load(code))?.rt || rt; }
  if (q.get('rev') && Number(q.get('rev')) === state.rev && !q.get('force')) return json({ unchanged: true, rev: state.rev });
  return json(viewFor(state, mid, today));
}

export async function POST(request) {
  if (!configured()) return json({ error: 'not_configured' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Невірний запит' }, 400); }
  const { member, action } = body || {};
  const today = isDate(body?.today) ? body.today : null;

  try {
    if (body.create) {
      for (let i = 0; i < 8; i++) {
        let state = newRoom(makeCode());
        state = applyAction(state, member, { type: 'join', name: action?.name }, today);
        state.rt = liveToken();
        if (await createUnique(state)) return json(viewFor(state, member.id, today));
      }
      return json({ error: 'Спробуй ще раз' }, 500);
    }
    const code = cleanCode(body.code);
    const result = await updateRoom(code, async (state) => {
      if (!state) return { out: json({ error: 'Пару не знайдено' }, 404) };
      const next = applyAction(state, member, action || {}, today);
      if (!next.rt) next.rt = liveToken();
      const changed = next.rev !== state.rev || action?.type === 'ping' || !state.rt;
      return { next: changed ? next : null, out: { res: json(viewFor(next, member.id, today)), before: state, next } };
    });
    if (result instanceof Response) return result;
    // Tell the partner about things that concern them (push), without slowing down on errors.
    await Promise.race([notifyAfterAction(code, action, result.before, result.next, member.id), new Promise((r) => setTimeout(r, 4000))]);
    return result.res;
  } catch (e) {
    if (e instanceof ActionError) return json({ error: e.message }, 400);
    if (e.message === 'busy') return json({ error: 'Сервер зайнятий, спробуй ще раз' }, 503);
    console.error(e);
    return json({ error: 'Помилка сервера' }, 500);
  }
}
