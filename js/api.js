import { API_URL, REQUEST_TIMEOUT_MS, HISTORY_LIMIT } from './config.js';

export class ShiviError extends Error {
  constructor(kind, detail) { super(kind); this.kind = kind; this.detail = detail; }
}

const FRIENDLY = {
  offline: 'Net nahi hai abhi 🥺 Tumhara message save hai, online aate hi main khud reply kar dungi 💗',
  timeout: 'Network bohot slow hai 🥺 Message save hai, thodi der me khud dobara try karungi 💗',
  rate: 'Arre itni jaldi? 😅 Thodi der ruko, phir baat karte hain.',
  setup: 'Mera dimaag abhi connect nahi hua 🙈 Backend URL set karna baaki hai.',
  server: 'Network thoda weak hai 🥺 Tumhara message save hai, net theek hote hi main khud reply kar dungi 💗',
  empty: 'Main thodi blank ho gayi 😳 Dobara bolo na?'
};
export const friendly = (kind) => FRIENDLY[kind] || FRIENDLY.server;

const configured = () => !API_URL.includes('YOUR-SUBDOMAIN');

// What Shivi "sees" for a sticker turn in the history.
const historyText = (m) => {
  if (m.kind !== 'sticker') return m.text; // voice notes keep their transcript
  const feel = m.tag && m.tag !== 'any' ? ` (${m.tag} mood)` : '';
  return m.role === 'user' ? `[sent a sticker${feel}]` : `[you sent a sticker${feel}]`;
};

const clock = () => new Date().toLocaleString('en-IN', { weekday: 'long', hour: 'numeric', minute: '2-digit' });

const RETRYABLE = ['timeout', 'server', 'empty'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// Weak internet: up to 3 quick tries with backoff before giving up (the app then keeps retrying by itself).
export async function sendToShivi(messages, opts = {}) {
  let err;
  for (let i = 0; i < 3; i++) {
    try { return await sendOnce(messages, opts); } catch (e) {
      err = e;
      if (!(e instanceof ShiviError) || !RETRYABLE.includes(e.kind) || !navigator.onLine) break;
      await wait(1200 * (i + 1));
    }
  }
  throw err;
}

async function sendOnce(messages, { memory = {}, image = null } = {}) {
  if (!navigator.onLine) throw new ShiviError('offline');
  if (!configured()) throw new ShiviError('setup', 'API_URL not set in js/config.js');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages.slice(-HISTORY_LIMIT).map((m) => ({ role: m.role, text: historyText(m) })),
        memory: { ...memory, clock: clock() },
        image
      }),
      signal: ctrl.signal
    });
    if (res.status === 429) throw new ShiviError('rate');
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ShiviError('server', `${res.status} ${data?.error || ''}`);
    const reply = typeof data?.reply === 'string' ? data.reply.trim() : '';
    if (!reply && !data?.sticker) throw new ShiviError('empty');
    return {
      reply,
      mood: data.mood || null,
      sticker: data.sticker && data.sticker !== 'none' ? data.sticker : null,
      remember: Array.isArray(data.remember) ? data.remember : [],
      forget: Array.isArray(data.forget) ? data.forget : [],
      voice: data.voice === true,
      speak: typeof data.speak === 'string' ? data.speak : ''
    };
  } catch (e) {
    if (e instanceof ShiviError) { console.error('[shivi]', e.kind, e.detail || ''); throw e; }
    console.error('[shivi]', e);
    throw new ShiviError(e.name === 'AbortError' ? 'timeout' : 'server', String(e));
  } finally { clearTimeout(timer); }
}

export async function checkConnection() {
  if (!navigator.onLine || !configured()) return false;
  try {
    const r = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(6000) });
    return r.ok;
  } catch { return false; }
}

// Ask the Worker to turn text into a sweet voice note. Returns a WAV Blob.
export async function fetchVoice(text, voice, mood) {
  if (!navigator.onLine) throw new ShiviError('offline');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(`${API_URL}/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, mood }),
      signal: ctrl.signal
    });
    if (!res.ok) { const e = await res.json().catch(() => null); throw new ShiviError(res.status === 429 ? 'rate' : 'server', `voice ${res.status} ${e?.error || ''}`); }
    const blob = await res.blob();
    if (!blob.size) throw new ShiviError('empty', 'voice empty');
    return blob;
  } catch (e) {
    if (e instanceof ShiviError) { console.error('[shivi]', e.kind, e.detail || ''); throw e; }
    throw new ShiviError(e.name === 'AbortError' ? 'timeout' : 'server', String(e));
  } finally { clearTimeout(timer); }
}
