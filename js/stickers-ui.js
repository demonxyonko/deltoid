import { MOODS, ANY, tagEmoji } from './moods.js';
import * as db from './stickers.js';
import * as ui from './ui.js';

const $ = (id) => document.getElementById(id);
const EMOJIS = ['😂', '🥹', '😭', '😍', '🥰', '😘', '😎', '🤗', '😅', '🙈', '😏', '🤭', '😴', '😤', '🤔', '🥺', '😡', '🙄', '🤩', '😌', '👍', '🙏', '🔥', '✨', '💖', '💔', '🎉', '🫶', '☕', '🍕'];

const tagOptions = (sel, current) => {
  sel.textContent = '';
  [[ANY, '✨ Kisi bhi mood ka'], ...MOODS.map((m) => [m.id, `${m.emoji} ${m.label}`])].forEach(([v, t]) => {
    const o = document.createElement('option'); o.value = v; o.textContent = t; sel.append(o);
  });
  sel.value = current;
};

export function initStickerUI({ onSticker, onEmoji, openManager }) {
  const tray = $('tray'), sgrid = $('stickerGrid'), egrid = $('emojiGrid'), mgrid = $('manageGrid');
  let selected = null, items = [];

  /* ---- tray ---- */
  const tab = (name) => {
    tray.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
    sgrid.hidden = name !== 'stickers'; egrid.hidden = name !== 'emoji';
  };
  tray.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => tab(b.dataset.tab)));
  $('manageBtn').onclick = () => openManager();
  EMOJIS.forEach((e) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = e; b.setAttribute('aria-label', e);
    b.onclick = () => onEmoji(e); egrid.append(b);
  });

  const cell = async (s, onClick, badge) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cell';
    b.setAttribute('aria-label', 'sticker');
    const img = document.createElement('img'); img.alt = ''; img.loading = 'lazy';
    b.append(img);
    if (badge) { const i = document.createElement('i'); i.textContent = tagEmoji(s.tag); b.append(i); }
    b.onclick = () => onClick(s, b);
    db.urlFor(s.id).then((u) => { if (u) img.src = u; });
    return b;
  };

  async function refresh() {
    items = await db.list();
    sgrid.textContent = ''; mgrid.textContent = '';
    if (!items.length) {
      const p = document.createElement('p'); p.className = 'hint';
      p.textContent = 'Abhi koi sticker nahi hai. Settings se ya ⚙ dabake add karo. Tab tak emoji tab use karo 💖';
      sgrid.append(p);
      const q = document.createElement('p'); q.className = 'hint'; q.textContent = 'Abhi koi sticker add nahi hua.'; mgrid.append(q);
    }
    for (const s of items) {
      sgrid.append(await cell(s, (x) => onSticker({ stickerId: x.id, tag: x.tag })));
      const m = await cell(s, (x) => select(x.id), true);
      if (s.id === selected) m.classList.add('sel');
      mgrid.append(m);
    }
    if (selected && !items.some((s) => s.id === selected)) select(null);
  }

  /* ---- manager sheet ---- */
  tagOptions($('newTag'), ANY); tagOptions($('pickTag'), ANY);
  function select(id) {
    selected = id;
    mgrid.querySelectorAll('.cell').forEach((c, i) => c.classList.toggle('sel', items[i]?.id === id));
    $('pickBar').hidden = !id;
    const s = items.find((x) => x.id === id);
    if (s) $('pickTag').value = s.tag;
  }
  $('addStickers').onclick = () => $('stickerFile').click();
  $('stickerFile').onchange = async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    if (!files.length) return;
    ui.toast('Stickers add ho rahe hain…');
    const { added, failed } = await db.addMany(files, $('newTag').value);
    ui.toast(`${added} sticker add hue${failed ? `, ${failed} nahi chale` : ''}`);
    refresh();
  };
  $('pickTag').onchange = async (e) => { if (selected) { await db.setTag(selected, e.target.value); refresh(); } };
  $('pickDel').onclick = async () => {
    if (!selected || !confirm('Ye sticker delete kar dun?')) return;
    await db.remove(selected); selected = null; $('pickBar').hidden = true; refresh();
  };

  refresh();
  return { refresh };
}
