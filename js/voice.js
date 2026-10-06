const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const voiceSupported = !!SR;

export function createVoice({ onText, onState }) {
  let rec = null;
  return () => {
    if (rec) { rec.stop(); return; }
    rec = new SR();
    rec.lang = 'en-IN'; // handles Hinglish reasonably well
    rec.interimResults = false;
    rec.onresult = (e) => onText(e.results[0][0].transcript);
    rec.onend = () => { rec = null; onState(false); };
    rec.onerror = (e) => console.warn('[voice]', e.error);
    try { rec.start(); onState(true); } catch { rec = null; onState(false); }
  };
}
