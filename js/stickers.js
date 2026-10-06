// Sticker library: images live in IndexedDB on this device (too big for localStorage).
import { MOODS, ANY } from './moods.js';

const DB = 'shivi-stickers', STORE = 'stickers';
const KEEP_AS_IS = 200 * 1024;   // small files keep their original bytes (animation survives)
const MAX_SIDE = 384;            // bigger images are shrunk to this
const INLINE_MAX = 250 * 1024;   // largest sticker we also show to Gemini
const INLINE_MIMES = ['image/png', 'image/jpeg', 'image/webp'];
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

export async function list() {
  try { return (await req('readonly', (s) => s.getAll())).sort((a, b) => a.t - b.t); } catch { return []; }
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

async function normalize(file) {
  if (!file.type.startsWith('image/')) return null;
  if (file.size <= KEEP_AS_IS) return file;
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return new Promise((r) => c.toBlob(r, 'image/webp', 0.86));
}

export async function addMany(files, tag = ANY) {
  let added = 0, failed = 0;
  for (const f of files) {
    try {
      const blob = await normalize(f);
      if (!blob) { failed++; continue; }
      await req('readwrite', (s) => s.put({ id: uid(), blob, mime: blob.type, tag, t: Date.now() + added }));
      added++;
    } catch { failed++; }
  }
  return { added, failed };
}

export async function setTag(id, tag) {
  const rec = await req('readonly', (s) => s.get(id));
  if (rec) await req('readwrite', (s) => s.put({ ...rec, tag }));
}

export async function remove(id) {
  await req('readwrite', (s) => s.delete(id));
  const u = urls.get(id);
  if (u) { URL.revokeObjectURL(u); urls.delete(id); }
}

let lastId = null;
// Pick a sticker for a mood: exact tag first, then "any". null means "use the emoji fallback".
export async function pickFor(tag) {
  const all = await list();
  const pool = all.filter((s) => s.tag === tag);
  const use = pool.length ? pool : all.filter((s) => s.tag === ANY);
  if (!use.length) return null;
  const fresh = use.length > 1 ? use.filter((s) => s.id !== lastId) : use;
  const pick = fresh[Math.floor(Math.random() * fresh.length)];
  lastId = pick.id;
  return pick;
}

// Which moods Shivi has a sticker for (a sticker tagged "any" covers every mood).
export async function availableMoods() {
  const all = await list();
  if (all.some((s) => s.tag === ANY)) return MOODS.map((m) => m.id);
  return [...new Set(all.map((s) => s.tag))];
}

// Base64 of a sticker so Shivi can actually see it (only small png/jpeg/webp).
export async function toInline(id) {
  try {
    const rec = await req('readonly', (s) => s.get(id));
    if (!rec || rec.blob.size > INLINE_MAX || !INLINE_MIMES.includes(rec.blob.type)) return null;
    const data = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(',')[1]);
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(rec.blob);
    });
    return { mime: rec.blob.type, data };
  } catch { return null; }
}
