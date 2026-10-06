import { APP_VERSION, MAX_INPUT } from './config.js';
import { sendToShivi, checkConnection, fetchVoice, friendly } from './api.js';
import { loadChat, saveChat, clearChat, loadPrefs, savePrefs } from './storage.js';
import { voiceSupported, createVoice } from './voice.js';
import * as memory from './memory.js';
import * as stickers from './stickers.js';
import * as vn from './voicenote.js';
import { initMemoryUI } from './memory-ui.js';
import { initStickerUI } from './stickers-ui.js';
import * as ui from './ui.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const input = $('input'), sendBtn = $('sendBtn'), tray = $('tray');
let messages = loadChat();
let prefs = loadPrefs();
let busy = false;

/* ---- viewport: keep the composer above the on-screen keyboard ---- */
const fitViewport = () => {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.documentElement.style.setProperty('--vh', `${h}px`);
  if (window.visualViewport) window.scrollTo(0, 0);
  ui.scrollDown();
};
window.visualViewport?.addEventListener('resize', fitViewport);
window.addEventListener('resize', fitViewport);
fitViewport();

/* ---- prefs ---- */
function syncPrefs() {
  ui.applyPrefs(prefs);
  $('setLight').checked = prefs.light; $('setSound').checked = prefs.sound; $('setAnim').checked = prefs.anim;
  $('setVoiceMode').value = prefs.voiceMode; $('setVoice').value = prefs.voice;
  savePrefs(prefs);
}
[['setLight', 'light'], ['setSound', 'sound'], ['setAnim', 'anim']].forEach(([id, key]) =>
  $(id).addEventListener('change', (e) => { prefs[key] = e.target.checked; syncPrefs(); }));
$('setVoiceMode').onchange = (e) => { prefs.voiceMode = e.target.value; syncPrefs(); };
$('setVoice').onchange = (e) => { prefs.voice = e.target.value; syncPrefs(); };
$('voicePreview').onclick = async () => {
  const btn = $('voicePreview');
  if (btn.disabled) return;
  btn.disabled = true; ui.toast('Awaaz aa rahi hai… 🎙️');
  try { await vn.playBlob(await fetchVoice('हाय! <giggle> मैं Shivi हूँ... <short pause> तुम्हारी बेस्टी।', prefs.voice, 'happy')); }
  catch { ui.toast('Abhi awaaz nahi bani, thodi der baad try karo'); }
  finally { btn.disabled = false; }
};
$('verText').textContent = APP_VERSION;

/* ---- sheets ---- */
const openSheet = (id) => {
  document.querySelectorAll('.sheet').forEach((s) => { s.hidden = s.id !== id; });
  if (id === 'sheet') refreshStatus();
};
const closeSheets = () => document.querySelectorAll('.sheet').forEach((s) => { s.hidden = true; });
$('menuBtn').onclick = () => openSheet('sheet');
$('avatarBtn').onclick = () => openSheet('sheet');
$('openMemory').onclick = () => openSheet('memorySheet');
$('openStickers').onclick = () => openSheet('stickerSheet');
document.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeSheets(); });
$('clearBtn').onclick = () => {
  if (!confirm('Clear the whole conversation? (Shivi ki memory nahi mitegi)')) return;
  messages = []; clearChat(); vn.clearAll(); ui.resetLog(); closeSheets();
};

/* ---- connection ---- */
async function refreshStatus() {
  ui.setStatus('wait');
  const ok = await checkConnection();
  ui.setStatus(ok ? 'on' : 'off');
  return ok;
}
window.addEventListener('online', refreshStatus);
window.addEventListener('offline', () => { ui.setStatus('off'); ui.banner('Offline — messages will work once you reconnect.'); });
window.addEventListener('online', () => ui.banner(''));

/* ---- chat ---- */
function push(role, text, extra = {}) {
  const m = { role, text, t: Date.now(), ...extra };
  ui.addMessage(m);
  if (!extra.error) { messages.push(m); saveChat(messages); }
}

// Don't let Shivi send stickers back-to-back.
const stickerRecently = () => messages.slice(-5).some((m) => m.role === 'model' && m.kind === 'sticker');

async function herSticker(tag) {
  const rec = await stickers.pickFor(tag);
  await sleep(450);
  push('model', '', { kind: 'sticker', stickerId: rec?.id || null, tag });
}

// Voice notes show up now and then, not on every reply: a gap, a dice roll, and a cool-off after a failure.
let voiceCooldown = 0;
function voiceAllowed() {
  if (prefs.voiceMode === 'off' || Date.now() < voiceCooldown) return false;
  const more = prefs.voiceMode === 'more';
  let since = Infinity;
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].kind === 'voice') { since = messages.length - 1 - i; break; }
  return since >= (more ? 4 : 10) && Math.random() < (more ? 0.6 : 0.3);
}

async function herVoice(res) {
  ui.showTyping(true, 'voice');
  try {
    const blob = await fetchVoice(res.speak || res.reply, prefs.voice, res.mood || memory.get().mood);
    const audioId = await vn.save(blob);
    ui.showTyping(false);
    push('model', res.reply, { kind: 'voice', audioId, dur: vn.durationOf(blob) });
  } catch {
    ui.showTyping(false);
    voiceCooldown = Date.now() + 5 * 60 * 1000; // voice is struggling: stay on text for a while
    push('model', res.reply);
    try { // fallback: the phone's own Hindi voice, so she still talks
      const u = new SpeechSynthesisUtterance(res.speak || res.reply); u.lang = 'hi-IN'; u.pitch = 1.2; u.rate = 0.95;
      speechSynthesis.speak(u);
    } catch { /* no speech support */ }
  }
}

async function askShivi() {
  busy = true; sendBtn.disabled = true;
  ui.showTyping(true);
  const started = Date.now();
  try {
    const last = messages[messages.length - 1];
    const image = last?.kind === 'sticker' && last.stickerId ? await stickers.toInline(last.stickerId) : null;
    const voiceOk = voiceAllowed();
    const mem = { ...memory.payload(), stickers: await stickers.availableMoods(), voiceOk };
    const hadSticker = stickerRecently();
    const res = await sendToShivi(messages, { memory: mem, image });
    const wait = 700 - (Date.now() - started); // keep the typing indicator readable
    if (wait > 0) await sleep(wait);
    ui.showTyping(false);
    if (res.mood) { ui.setMood(res.mood); memory.setMood(res.mood); }
    if (res.reply && voiceOk && res.voice) await herVoice(res);
    else if (res.reply) push('model', res.reply);
    const { added, removed } = memory.applyUpdates(res);
    if (added.length) ui.toast(`💾 Yaad rakh liya: ${added[0]}${added.length > 1 ? ` (+${added.length - 1})` : ''}`);
    else if (removed.length) ui.toast('Bhula diya ✓');
    if (res.sticker && !hadSticker) await herSticker(res.sticker);
    if (prefs.sound) ui.blip();
    ui.setStatus('on');
    needsRetry = false;
  } catch (e) {
    ui.showTyping(false);
    document.querySelectorAll('.msg.err').forEach((n) => n.remove());
    push('model', friendly(e.kind), { error: true });
    if (e.kind !== 'rate') ui.setStatus('off');
    needsRetry = ['offline', 'timeout', 'server', 'empty'].includes(e.kind);
  } finally { busy = false; sendBtn.disabled = false; }
}

// Message is saved; when the net is back (or every 15s) Shivi just answers on her own.
let needsRetry = false;
async function autoRetry() {
  if (!needsRetry || busy || !navigator.onLine || messages[messages.length - 1]?.role !== 'user') return;
  document.querySelectorAll('.msg.err').forEach((n) => n.remove());
  await askShivi();
}
window.addEventListener('online', () => setTimeout(autoRetry, 800));
setInterval(autoRetry, 15000);

async function send(raw) {
  const text = raw.trim().slice(0, MAX_INPUT);
  if (!text || busy) return;
  input.value = ''; autosize(); closeTray();
  push('user', text);
  await askShivi();
  input.focus();
}

async function sendSticker({ stickerId, tag }) {
  if (busy) return;
  closeTray();
  push('user', '', { kind: 'sticker', stickerId, tag });
  await askShivi();
}

function autosize() { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 132)}px`; }
input.addEventListener('input', autosize);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && matchMedia('(hover:hover)').matches) { e.preventDefault(); send(input.value); }
});
sendBtn.onclick = () => send(input.value);
document.querySelectorAll('[data-say]').forEach((b) => (b.onclick = () => send(b.dataset.say)));
input.addEventListener('focus', () => { closeTray(); setTimeout(ui.scrollDown, 300); });

/* ---- stickers + emoji tray ---- */
function closeTray() { tray.hidden = true; $('stickerBtn').classList.remove('on'); }
$('stickerBtn').onclick = () => {
  const open = tray.hidden;
  if (open) input.blur();
  tray.hidden = !open; $('stickerBtn').classList.toggle('on', open);
  setTimeout(ui.scrollDown, 50);
};
initStickerUI({
  onSticker: sendSticker,
  onEmoji: (e) => { input.value += e; autosize(); },
  openManager: () => openSheet('stickerSheet')
});

/* ---- memory ---- */
initMemoryUI();

/* ---- voice input (progressive) ---- */
if (voiceSupported) {
  const mic = $('micBtn'); mic.hidden = false;
  mic.onclick = createVoice({
    onText: (t) => { input.value = t; send(t); },
    onState: (on) => mic.classList.toggle('rec', on)
  });
}

/* ---- boot ---- */
syncPrefs();
ui.setMood(memory.get().mood);
ui.spawnHearts();
messages.forEach(ui.addMessage);
if (messages.length) $('empty').hidden = true;
refreshStatus();
requestAnimationFrame(() => setTimeout(() => document.body.classList.add('ready'), 500));

if ('serviceWorker' in navigator) {
  // When a new version takes over, reload once so the phone never keeps showing old files.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded) { reloaded = true; location.reload(); }
  });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('[sw]', e)));
}
