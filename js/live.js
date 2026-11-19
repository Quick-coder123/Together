// Live updates: Supabase Realtime pings this phone the moment the partner changes something,
// so the app refreshes instantly instead of waiting for the next poll.
// The channel name is the pair's secret live token (room.rt); messages carry only a version number.
import { S, refresh } from './store.js';

const WS = 'wss://qtoikxaqadyjydvlzhcu.supabase.co/realtime/v1/websocket?apikey=sb_publishable_KKcAPJyiT3wBKOZD2km4RQ_P6uzwePs&vsn=1.0.0';
let ws = null, topic = '', ref = 0, hb = 0, retry = 0, timer = 0, lastMsg = 0;
export const liveOn = () => !!ws && ws.readyState === 1 && Date.now() - lastMsg < 70000;

function send(msg) { if (ws?.readyState === 1) ws.send(JSON.stringify({ ...msg, ref: String(++ref) })); }
function stop() { clearInterval(hb); clearTimeout(timer); if (ws) { ws.onclose = null; try { ws.close(); } catch { /* closed */ } } ws = null; }
function connect() {
  stop();
  const rt = S.room?.rt;
  if (!rt || document.visibilityState !== 'visible' || !('WebSocket' in window)) return;
  topic = 'realtime:room-' + rt;
  ws = new WebSocket(WS);
  ws.onopen = () => {
    retry = 0; lastMsg = Date.now();
    send({ topic, event: 'phx_join', payload: { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, private: false } } });
    hb = setInterval(() => send({ topic: 'phoenix', event: 'heartbeat', payload: {} }), 25000);
  };
  ws.onmessage = (e) => {
    lastMsg = Date.now();
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.topic === topic && m.event === 'broadcast' && m.payload?.event === 'changed') {
      const rev = m.payload.payload?.rev;
      if (rev == null || rev !== S.room?.rev) refresh();
    }
  };
  ws.onclose = () => { ws = null; clearInterval(hb); timer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry++)); };
  ws.onerror = () => { try { ws?.close(); } catch { /* closed */ } };
}
/** Call after every render: (re)joins when the pair or its token changes. */
export function liveSync() {
  const want = S.room?.rt ? 'realtime:room-' + S.room.rt : '';
  if (!want) return stop();
  if (want !== topic || !ws) connect();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { if (!ws) connect(); } else stop(); });
window.addEventListener('online', () => connect());
