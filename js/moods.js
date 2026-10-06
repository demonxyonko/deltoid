// Mood ids must match worker/persona.js.
export const MOODS = [
  { id: 'happy',    emoji: '😄', label: 'khush',        color: '#f4c95d' },
  { id: 'excited',  emoji: '🤩', label: 'excited',      color: '#ff9a5c' },
  { id: 'playful',  emoji: '😜', label: 'masti',        color: '#ee86cf' },
  { id: 'flirty',   emoji: '😘', label: 'flirty',       color: '#ff6b9a' },
  { id: 'caring',   emoji: '🥰', label: 'caring',       color: '#f0a3b0' },
  { id: 'sad',      emoji: '🥺', label: 'udaas',        color: '#7fa6d6' },
  { id: 'annoyed',  emoji: '😤', label: 'naraz',        color: '#e0675f' },
  { id: 'sleepy',   emoji: '😴', label: 'sleepy',       color: '#9a8fd1' },
  { id: 'shy',      emoji: '🙈', label: 'sharma rahi',  color: '#f3a6a0' },
  { id: 'thinking', emoji: '🤔', label: 'soch rahi',    color: '#7bc5b5' }
];
export const MOOD = Object.fromEntries(MOODS.map((m) => [m.id, m]));
export const ANY = 'any'; // sticker tag meaning "fits every mood"
export const tagEmoji = (tag) => (tag === ANY ? '✨' : MOOD[tag]?.emoji || '💖');

const ONLY_EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u200d\uFE0F\u20E3\u{1F3FB}-\u{1F3FF}\s]/gu;
export function isEmojiOnly(text) {
  const t = String(text || '').trim();
  if (!t || [...t].length > 8) return false;
  return /\p{Extended_Pictographic}/u.test(t) && t.replace(ONLY_EMOJI, '') === '';
}
