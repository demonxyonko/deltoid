import { MOOD, tagEmoji, isEmojiOnly } from './moods.js';
import { urlFor } from './stickers.js';
import * as vn from './voicenote.js';

const $ = (id) => document.getElementById(id);
const chat = $('chat'), log = $('log'), empty = $('empty');

const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const scrollDown = () => { chat.scrollTop = chat.scrollHeight; };

function renderSticker(box, m) {
  const fallback = () => { box.textContent = ''; const b = document.createElement('span'); b.className = 'big'; b.textContent = tagEmoji(m.tag); box.append(b); };
  if (!m.stickerId) return fallback();
  const img = document.createElement('img');
  img.alt = 'sticker'; img.decoding = 'async';
  img.addEventListener('load', scrollDown);
  box.append(img);
  urlFor(m.stickerId).then((u) => { if (u) img.src = u; else fallback(); });
}


const fmtDur = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Voice note bubble: play button, little waveform, duration, and a transcript toggle.
function renderVoice(el, m) {
  const box = document.createElement('div'); box.className = 'vn';
  const play = document.createElement('button'); play.type = 'button'; play.className = 'play'; play.setAttribute('aria-label', 'Voice message sunao');
  play.innerHTML = '<svg class="i-play" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg><svg class="i-pause" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
  const wave = document.createElement('div'); wave.className = 'wave'; wave.setAttribute('aria-hidden', 'true');
  let seed = (m.t || 1) % 9973;
  const bars = Array.from({ length: 26 }, () => {
    seed = (seed * 9301 + 49297) % 233280;
    const b = document.createElement('i'); b.style.setProperty('--h', `${22 + Math.round((seed / 233280) * 70)}%`);
    wave.append(b); return b;
  });
  const dur = document.createElement('span'); dur.className = 'dur'; dur.textContent = fmtDur(m.dur || 3);
  const tx = document.createElement('button'); tx.type = 'button'; tx.className = 'tx'; tx.textContent = 'Aa'; tx.setAttribute('aria-label', 'Text dikhao');
  const text = document.createElement('p'); text.className = 'vtext'; text.hidden = true; text.textContent = m.text;
  tx.onclick = () => { text.hidden = !text.hidden; scrollDown(); };
  box.append(play, wave, dur, tx);
  el.append(box, text);
  vn.urlFor(m.audioId).then((u) => {
    if (!u) { box.remove(); text.hidden = false; return; } // audio gone: just show the words
    play.onclick = () => vn.toggle(u, play, bars);
  });
}

export function addMessage(m) {
  empty.hidden = true;
  const el = document.createElement('div');
  el.className = `msg ${m.role === 'user' ? 'me' : 'her'}${m.error ? ' err' : ''}`;
  if (m.kind === 'voice') {
    el.classList.add('voice');
    renderVoice(el, m);
  } else if (m.kind === 'sticker') {
    el.classList.add('sticker');
    const box = document.createElement('div'); box.className = 'stk';
    el.append(box); renderSticker(box, m);
  } else if (isEmojiOnly(m.text)) {
    el.classList.add('emoji');
    el.append(document.createTextNode(m.text));
  } else {
    el.append(document.createTextNode(m.text));
  }
  const time = document.createElement('time');
  time.textContent = fmtTime(m.t);
  el.append(time);
  log.append(el);
  scrollDown();
}

let typingEl = null;
export function showTyping(on, kind = 'text') {
  if (on && !typingEl) {
    typingEl = document.createElement('div');
    typingEl.className = `msg her typing${kind === 'voice' ? ' rec' : ''}`;
    typingEl.innerHTML = `${kind === 'voice' ? '<b aria-hidden="true">🎙️</b>' : ''}<span></span><span></span><span></span>`;
    typingEl.setAttribute('aria-label', kind === 'voice' ? 'Shivi is recording a voice message' : 'Shivi is typing');
    log.append(typingEl); scrollDown();
  } else if (!on && typingEl) { typingEl.remove(); typingEl = null; }
}

export function resetLog() { log.textContent = ''; empty.hidden = false; }

export function setStatus(state) {
  const s = $('status');
  s.className = `status ${state === 'on' ? 'on' : state === 'off' ? 'off' : ''}`;
  $('statusText').textContent = { on: 'online', off: 'offline', wait: 'connecting…' }[state];
  $('connText').textContent = { on: 'Connected', off: 'Not connected', wait: 'Checking…' }[state];
}

export function setMood(id) {
  const m = MOOD[id] || MOOD.happy;
  document.body.dataset.mood = m.id;
  document.documentElement.style.setProperty('--mood', m.color);
  $('moodTag').textContent = `${m.emoji} ${m.label}`;
}

let toastTimer;
export function toast(text) {
  const t = $('toast');
  t.textContent = text; t.hidden = false;
  t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

export function banner(text) { const b = $('banner'); b.hidden = !text; b.textContent = text || ''; }

export function applyPrefs(p) {
  document.documentElement.dataset.theme = p.light ? 'light' : 'dark';
  document.querySelector('meta[name=theme-color]').content = p.light ? '#fff3f4' : '#1a0a1f';
  document.body.classList.toggle('anim', p.anim);
}

export function spawnHearts() {
  const box = $('hearts');
  box.textContent = '';
  for (let i = 0; i < 7; i++) {
    const h = document.createElement('i');
    h.textContent = i % 2 ? '♥' : '✦';
    h.style.cssText = `left:${8 + i * 13}%;font-size:${10 + (i * 5) % 12}px;--dx:${(i % 2 ? 1 : -1) * 20}px;animation-duration:${14 + i * 3}s;animation-delay:${i * 2.2}s`;
    box.append(h);
  }
}

let ctx;
export function blip() {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(660, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + .12);
    g.gain.setValueAtTime(.06, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .18);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .2);
  } catch { /* sound is optional */ }
}
