// Turning push notifications on/off on this device.
import { S, toast } from './store.js';

const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

// What the UI should say about notifications on this device.
export async function pushState() {
  if (!pushSupported()) return ios() && !standalone() ? 'need-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

const b64ToBytes = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const post = (body) => fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: S.code, member: S.me.id, ...body }) }).then((r) => r.json());

export async function enablePush() {
  if (!pushSupported()) {
    toast(ios() && !standalone() ? 'На iPhone сповіщення працюють лише із застосунку на головному екрані' : 'Цей браузер не підтримує сповіщення');
    return false;
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('Сповіщення не дозволено. Їх можна увімкнути в налаштуваннях телефона.'); return false; }
  const { publicKey } = await fetch('/api/push').then((r) => r.json());
  if (!publicKey) { toast('Сервер сповіщень ще не готовий'); return false; }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
  const r = await post({ op: 'subscribe', sub: sub.toJSON() });
  if (!r.ok) { toast(r.error || 'Не вдалося увімкнути'); return false; }
  return true;
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) { await post({ op: 'unsubscribe', endpoint: sub.endpoint }); await sub.unsubscribe(); }
}

export const testPush = () => post({ op: 'test' });

// Keep the server's copy fresh (subscriptions can change after an iOS update).
export async function resyncPush() {
  try {
    if (!pushSupported() || Notification.permission !== 'granted' || !S.code) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await post({ op: 'subscribe', sub: sub.toJSON() });
  } catch {}
}
