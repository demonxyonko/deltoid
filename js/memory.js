// Shivi's memory: biodata + facts + last mood. Lives only in this browser (localStorage).
const KEY = 'shivi.memory.v1';
export const MAX_BIO = 6000, MAX_FACTS = 60, MAX_FACT = 160;

const blank = () => ({ bio: '', facts: [], mood: 'happy' });
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
const clean = (s, n = MAX_FACT) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const key = (s) => clean(s).toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '');

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (!raw || typeof raw !== 'object') return blank();
    return {
      bio: typeof raw.bio === 'string' ? raw.bio.slice(0, MAX_BIO) : '',
      facts: Array.isArray(raw.facts) ? raw.facts.filter((f) => f && typeof f.id === 'string' && typeof f.text === 'string').slice(0, MAX_FACTS) : [],
      mood: typeof raw.mood === 'string' ? raw.mood : 'happy'
    };
  } catch { return blank(); }
}

let state = load();
const listeners = new Set();
const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('[memory]', e); }
  listeners.forEach((fn) => fn(state));
};

export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const get = () => state;

export function setBio(text) { state.bio = String(text || '').slice(0, MAX_BIO); save(); }
export function setMood(id) { if (state.mood !== id) { state.mood = id; save(); } }

export function addFact(text, src = 'user') {
  const t = clean(text);
  if (!t) return null;
  const k = key(t);
  const dup = state.facts.find((f) => key(f.text) === k);
  if (dup) return null;
  const fact = { id: uid(), text: t, src, t: Date.now() };
  state.facts.push(fact);
  while (state.facts.length > MAX_FACTS) { // drop the oldest auto-learned fact first
    const i = state.facts.findIndex((f) => f.src === 'auto');
    state.facts.splice(i === -1 ? 0 : i, 1);
  }
  save();
  return fact;
}

export function removeFact(id) {
  const n = state.facts.length;
  state.facts = state.facts.filter((f) => f.id !== id);
  if (state.facts.length !== n) save();
  return state.facts.length !== n;
}

// Apply what the model said to remember / forget. Returns what actually changed.
export function applyUpdates({ remember = [], forget = [] } = {}) {
  const removed = [], added = [];
  for (const id of forget) {
    const f = state.facts.find((x) => x.id === id);
    if (f && removeFact(id)) removed.push(f.text);
  }
  for (const text of remember) { const f = addFact(text, 'auto'); if (f) added.push(f.text); }
  return { added, removed };
}

export function payload() {
  return { bio: state.bio, facts: state.facts.map(({ id, text }) => ({ id, text })), mood: state.mood };
}

export function clearAll() { state = blank(); save(); }

export const exportJSON = () => JSON.stringify({ shivi_memory: 1, bio: state.bio, facts: state.facts, mood: state.mood });

export function importJSON(raw) {
  const o = JSON.parse(raw);
  if (!o || o.shivi_memory !== 1) throw new Error('not a Shivi backup');
  state = {
    bio: typeof o.bio === 'string' ? o.bio.slice(0, MAX_BIO) : '',
    facts: (Array.isArray(o.facts) ? o.facts : []).filter((f) => f && typeof f.text === 'string')
      .map((f) => ({ id: typeof f.id === 'string' ? f.id : uid(), text: clean(f.text), src: f.src === 'auto' ? 'auto' : 'user', t: f.t || Date.now() })).slice(0, MAX_FACTS),
    mood: typeof o.mood === 'string' ? o.mood : 'happy'
  };
  save();
}
