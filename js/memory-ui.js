import * as memory from './memory.js';
import * as ui from './ui.js';

const $ = (id) => document.getElementById(id);

export function initMemoryUI() {
  const bio = $('bioInput'), state = $('bioState'), list = $('factList');
  let timer;

  const renderCount = () => { $('bioCount').textContent = `${bio.value.length} / ${memory.MAX_BIO}`; };

  function renderFacts() {
    const facts = memory.get().facts;
    list.textContent = '';
    if (!facts.length) {
      const li = document.createElement('li'); li.className = 'none';
      li.textContent = 'Abhi kuch nahi. Baat karte karte Shivi khud yaad rakhegi.';
      list.append(li);
      return;
    }
    [...facts].reverse().forEach((f) => {
      const li = document.createElement('li');
      const span = document.createElement('span'); span.textContent = f.text;
      const b = document.createElement('button');
      b.className = 'x'; b.type = 'button'; b.textContent = '×'; b.setAttribute('aria-label', `Bhula do: ${f.text}`);
      b.onclick = () => memory.removeFact(f.id);
      li.append(span, b);
      list.append(li);
    });
  }

  bio.value = memory.get().bio; renderCount(); renderFacts();
  bio.addEventListener('input', () => {
    renderCount(); state.textContent = 'saving…';
    clearTimeout(timer);
    timer = setTimeout(() => { memory.setBio(bio.value); state.textContent = '✓ saved'; }, 450);
  });

  const addFact = () => {
    const inp = $('factInput');
    if (memory.addFact(inp.value, 'user')) ui.toast('Yaad rakh liya ✓');
    inp.value = '';
  };
  $('factAdd').onclick = addFact;
  $('factInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addFact(); } });

  // Keep the list in sync when Shivi learns something mid-chat.
  memory.onChange(() => { renderFacts(); if (document.activeElement !== bio) bio.value = memory.get().bio; renderCount(); });

  $('memCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(memory.exportJSON()); ui.toast('Backup copy ho gaya 📋'); }
    catch { prompt('Is backup ko copy kar lo:', memory.exportJSON()); }
  };
  $('memRestore').onclick = async () => {
    let raw = null;
    try { raw = await navigator.clipboard.readText(); } catch { /* ask instead */ }
    if (!raw || !raw.includes('shivi_memory')) raw = prompt('Backup yahan paste karo:');
    if (!raw) return;
    try { memory.importJSON(raw); bio.value = memory.get().bio; renderCount(); ui.setMood(memory.get().mood); ui.toast('Memory wapas aa gayi ✓'); }
    catch { ui.toast('Ye Shivi ka backup nahi lag raha'); }
  };
  $('memClear').onclick = () => {
    if (!confirm('Shivi ki saari memory (biodata + yaad ki hui baatein) mita dun?')) return;
    memory.clearAll(); bio.value = ''; renderCount(); ui.setMood('happy'); ui.toast('Memory saaf ho gayi');
  };
}
