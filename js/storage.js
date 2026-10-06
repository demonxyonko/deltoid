const K = { chat: 'shivi.chat.v1', prefs: 'shivi.prefs.v1' };
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('[storage]', e); } };

export const loadChat = () => read(K.chat, []);
export const saveChat = (m) => write(K.chat, m.slice(-200));
export const clearChat = () => localStorage.removeItem(K.chat);
export const loadPrefs = () => ({ light: false, sound: true, anim: !matchMedia('(prefers-reduced-motion: reduce)').matches, voiceMode: 'some', voice: 'Achernar', ...read(K.prefs, {}) });
export const savePrefs = (p) => write(K.prefs, p);
