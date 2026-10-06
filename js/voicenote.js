// Voice notes: audio blobs are kept in IndexedDB so a note can be replayed after a reload.
const DB = 'shivi-voice', STORE = 'notes', KEEP = 30;
const BYTES_PER_SEC = 24000 * 2; // 24 kHz, 16-bit mono WAV
const urls = new Map();
let dbp;

const open = () => (dbp ||= new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));
const req = (mode, make) => open().then((db) => new Promise((res, rej) => {
  const t = db.transaction(STORE, mode);
  const r = make(t.objectStore(STORE));
  t.oncomplete = () => res(r.result);
  t.onerror = () => rej(t.error);
  t.onabort = () => rej(t.error);
}));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

export const durationOf = (blob) => Math.max(1, Math.round((blob.size - 44) / BYTES_PER_SEC));

export async function save(blob) {
  const id = uid();
  await req('readwrite', (s) => s.put({ id, blob, t: Date.now() }));
  prune().catch(() => {});
  return id;
}

async function prune() {
  const all = (await req('readonly', (s) => s.getAll())).sort((a, b) => a.t - b.t);
  for (const old of all.slice(0, Math.max(0, all.length - KEEP))) {
    await req('readwrite', (s) => s.delete(old.id));
    const u = urls.get(old.id); if (u) { URL.revokeObjectURL(u); urls.delete(old.id); }
  }
}

export async function urlFor(id) {
  if (!id) return null;
  if (urls.has(id)) return urls.get(id);
  try {
    const rec = await req('readonly', (s) => s.get(id));
    if (!rec) return null;
    const u = URL.createObjectURL(rec.blob);
    urls.set(id, u);
    return u;
  } catch { return null; }
}

export const urlOfBlob = (blob) => URL.createObjectURL(blob);

export async function clearAll() {
  try { await req('readwrite', (s) => s.clear()); } catch { /* nothing stored */ }
  urls.forEach((u) => URL.revokeObjectURL(u)); urls.clear();
}

/* One shared player: starting a note stops the previous one. */
const audio = new Audio();
let current = null; // { btn, bars, onEnd }
const reset = () => {
  if (!current) return;
  current.btn.classList.remove('playing'); current.btn.setAttribute('aria-label', 'Voice message sunao');
  current.bars.forEach((b) => b.classList.remove('on'));
  current = null;
};
audio.addEventListener('ended', reset);
audio.addEventListener('timeupdate', () => {
  if (!current || !audio.duration) return;
  const n = Math.floor((audio.currentTime / audio.duration) * current.bars.length);
  current.bars.forEach((b, i) => b.classList.toggle('on', i < n));
});

export async function toggle(url, btn, bars) {
  if (current && current.btn === btn && !audio.paused) { audio.pause(); reset(); return; }
  reset();
  audio.src = url;
  current = { btn, bars };
  btn.classList.add('playing'); btn.setAttribute('aria-label', 'Roko');
  try { await audio.play(); } catch (e) { console.warn('[voice]', e); reset(); }
}

export async function playBlob(blob) { // for the settings preview
  reset();
  const u = urlOfBlob(blob);
  audio.src = u;
  try { await audio.play(); } catch (e) { console.warn('[voice]', e); }
  audio.addEventListener('ended', () => URL.revokeObjectURL(u), { once: true });
}
