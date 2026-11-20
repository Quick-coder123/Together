// Voice input panel for Шептунчик — a vanilla-JS rebuild of Kokonut UI «AI Voice»
// (https://kokonutui.com/docs/ai/ai-voice, MIT licence, © kokonutui), with the same timings and movement:
//  • one round button whose face crossfades mic → stop → play/pause (200 ms, scale + blur);
//  • a red ring behind it that swells with the voice;
//  • 48 bars scrolling right-to-left (a new sample every 70 ms), edges faded while recording;
//  • review: the whole take squeezed into the row, bars settle right-to-left, a playhead sweeps it;
//  • «Скасувати» / «Надіслати» slide in with a little blur.
// Unlike the original, the waveform follows the REAL microphone level and playback plays the real take.
import { icon } from './ui.js';

const BAR_COUNT = 48;
const BAR_PITCH = 5; // bar width + gap, px
const SAMPLE_MS = 70;
const REST = 0.12;
const IDS = Array.from({ length: BAR_COUNT + 1 }, (_, i) => i);
const STILL = IDS.map((i) => 0.25 + 0.5 * Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.21)));
const MAX_SEC = 40;
const fmt = (s) => { const w = Math.floor(s); return `${String(Math.floor(w / 60)).padStart(2, '0')}:${String(w % 60).padStart(2, '0')}`; };
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function condense(take) {
  if (!take.length) return STILL.slice(0, BAR_COUNT);
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    const from = Math.floor((i / BAR_COUNT) * take.length), to = Math.max(from + 1, Math.floor(((i + 1) / BAR_COUNT) * take.length));
    return Math.max(REST, ...take.slice(from, to));
  });
}
const setScales = (bars, lv) => bars.forEach((b, i) => { b.style.transform = `scaleY(${(lv[i] ?? REST).toFixed(3)})`; });

/**
 * Opens the panel inside `host` and starts recording right away.
 * onSend(blob, seconds) → when the take is sent; onClose() → when the panel goes away (sent or discarded).
 */
export function openVoicePanel(host, { onSend, onClose, onError }) {
  host.innerHTML = `<div class="vx" data-mode="idle">
    <div class="vx-btn-wrap"><span class="vx-ring" aria-hidden="true"></span>
      <button class="vx-btn" type="button" aria-label="Почати запис">
        <span class="vx-face" data-f="mic">${icon('mic', 24)}</span>
        <span class="vx-face" data-f="stop"><i class="vx-stop"></i></span>
        <span class="vx-face" data-f="play">${icon('play', 22)}</span>
        <span class="vx-face" data-f="pause">${icon('pause', 22)}</span>
      </button></div>
    <span class="vx-timer"><i class="vx-dot" aria-hidden="true"></i><span>00:00</span></span>
    <div class="vx-wave" aria-hidden="true">
      <div class="vx-row">${IDS.map(() => '<span></span>').join('')}</div>
      <div class="vx-played">${IDS.map(() => '<span></span>').join('')}</div>
    </div>
    <div class="vx-foot">
      <span class="vx-cap">Натисни й говори</span>
      <div class="vx-acts"><button type="button" class="vx-discard">${icon('x', 14)} Скасувати</button><button type="button" class="vx-send">Надіслати ${icon('up', 14)}</button></div>
    </div>
    <output class="sr-only" aria-live="polite"></output>
  </div>`;
  const root = host.firstElementChild;
  const $ = (s) => root.querySelector(s);
  const btn = $('.vx-btn'), ring = $('.vx-ring'), row = $('.vx-row'), played = $('.vx-played'), timer = $('.vx-timer span'), cap = $('.vx-cap'), out = $('output');
  const bars = [...row.children], pbars = [...played.children];
  bars.forEach((b, i) => { b.style.transform = `scaleY(${REST})`; b.style.transitionDelay = `${(BAR_COUNT - i) * 6}ms`; });
  pbars.forEach((b) => { b.style.transform = `scaleY(${REST})`; });

  let mode = 'idle', stream = null, mr = null, chunks = [], ac = null, an = null, buf = null, take = [], t0 = 0, raf = 0, tmr = 0, limit = 0;
  let ready = Promise.resolve(), blob = null, duration = 0, audio = null, url = '', playing = false, closed = false;

  const setMode = (m) => {
    mode = m; root.dataset.mode = m;
    btn.setAttribute('aria-label', m === 'recording' ? 'Зупинити запис' : m === 'review' ? (playing ? 'Пауза' : 'Прослухати') : 'Почати запис');
    root.querySelectorAll('.vx-face').forEach((f) => f.classList.toggle('on', f.dataset.f === (m === 'idle' ? 'mic' : m === 'recording' ? 'stop' : playing ? 'pause' : 'play')));
    cap.textContent = m === 'recording' ? 'Слухаю…' : 'Натисни й говори';
    out.textContent = m === 'recording' ? 'Йде запис' : m === 'review' ? 'Запис готовий до надсилання' : '';
  };

  const level = () => { // RMS of the latest audio frame → 0..1, shaped so normal speech fills the bars
    if (!an) return REST;
    an.getFloatTimeDomainData(buf);
    let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    const rms = Math.sqrt(s / buf.length);
    return Math.max(REST, Math.min(1, Math.pow(rms * 4.2, 0.65)));
  };

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return onError?.('Цей браузер не вміє записувати голос 😔');
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch { return onError?.('Дозволь доступ до мікрофона в налаштуваннях 🎤'); }
    if (closed) return stream.getTracks().forEach((t) => t.stop());
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ac = new AC(); an = ac.createAnalyser(); an.fftSize = 1024; buf = new Float32Array(an.fftSize);
      ac.createMediaStreamSource(stream).connect(an);
    } catch { an = null; }
    chunks = []; mr = new MediaRecorder(stream);
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    ready = new Promise((res) => { mr.onstop = () => { blob = new Blob(chunks, { type: mr.mimeType || 'audio/mp4' }); res(); }; });
    mr.start(250);
    take = []; t0 = Date.now(); setMode('recording'); navigator.vibrate?.(12);
    tmr = setInterval(() => { timer.textContent = fmt((Date.now() - t0) / 1000); }, 250);
    limit = setTimeout(stop, MAX_SEC * 1000);
    if (reduced()) { setScales(bars, STILL); take = STILL.slice(); return; }
    const samples = IDS.map(() => REST);
    let phase = 0, smooth = 0, last = performance.now();
    const tick = (now) => {
      const dt = Math.min(now - last, 100); last = now;
      phase += dt / SAMPLE_MS;
      while (phase >= 1) { phase -= 1; const v = level(); samples.shift(); samples.push(v); take.push(v); }
      row.style.transform = `translateX(${(-phase * BAR_PITCH).toFixed(2)}px)`;
      setScales(bars, samples);
      smooth += (samples[samples.length - 1] - smooth) * 0.18;
      const lift = Math.max(0, smooth - REST);
      ring.style.transform = `scale(${(1 + lift * 0.22).toFixed(3)})`;
      ring.style.opacity = (0.4 + lift * 0.8).toFixed(3);
      if (!closed && host.isConnected) raf = requestAnimationFrame(tick); else cleanup();
    };
    raf = requestAnimationFrame(tick);
  }

  function stopMic() {
    cancelAnimationFrame(raf); clearInterval(tmr); clearTimeout(limit);
    try { mr && mr.state !== 'inactive' && mr.stop(); } catch { /* stopped */ }
    stream?.getTracks().forEach((t) => t.stop()); stream = null;
    try { ac?.close(); } catch { /* closed */ } ac = null; an = null;
    ring.style.transform = 'scale(1)'; ring.style.opacity = '0';
  }
  function stop() {
    if (mode !== 'recording') return;
    duration = Math.max((Date.now() - t0) / 1000, take.length * (SAMPLE_MS / 1000));
    stopMic();
    played.style.clipPath = 'inset(0 100% 0 0)';
    row.style.transform = 'translateX(0px)';
    const lv = condense(take);
    setMode('review');
    timer.textContent = fmt(duration);
    requestAnimationFrame(() => { setScales(bars, lv); setScales(pbars, lv); });
  }
  function togglePlay() {
    if (!blob) return;
    if (playing) { audio?.pause(); playing = false; setMode('review'); return; }
    url ||= URL.createObjectURL(blob);
    audio ||= new Audio(url);
    audio.currentTime = 0; played.style.clipPath = 'inset(0 100% 0 0)';
    playing = true; setMode('review');
    audio.play().catch(() => {});
    const startedAt = performance.now(), len = Math.max(duration, 1) * 1000;
    const tick = (now) => {
      if (!playing) return;
      const p = Math.min((audio && isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration : (now - startedAt) / len), 1);
      played.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(2)}% 0 0)`;
      timer.textContent = fmt(p * duration);
      if (p < 1 && !audio.ended) requestAnimationFrame(tick); else { playing = false; setMode('review'); played.style.clipPath = 'inset(0 0% 0 0)'; }
    };
    requestAnimationFrame(tick);
  }
  function cleanup() { closed = true; stopMic(); audio?.pause(); if (url) URL.revokeObjectURL(url); }
  async function finish(sent) {
    if (closed) return;
    if (mode === 'recording') stop();
    const d = duration;
    cleanup();
    root.classList.add('leaving');
    await Promise.all([ready, new Promise((r) => setTimeout(r, 160))]);
    onClose?.();
    if (sent && blob) onSend?.(blob, d);
  }

  btn.addEventListener('click', () => { if (mode === 'recording') stop(); else if (mode === 'review') togglePlay(); else start(); });
  $('.vx-discard').addEventListener('click', () => finish(false));
  $('.vx-send').addEventListener('click', () => finish(true));
  setMode('idle');
  start();
  return { stop, close: () => finish(false), get mode() { return mode; } };
}
