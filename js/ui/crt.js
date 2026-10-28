// Attiva/disattiva l'effetto CRT (css/crt.css). La scelta viene ricordata.
const KEY = 'crt';

function apply(on) { document.body.classList.toggle('crt-off', !on); }

export function initCrt() {
  let on = false; // di base spento: si accende col bottone CRT e la scelta viene ricordata
  try { on = localStorage.getItem(KEY) === 'on'; } catch { /* storage non disponibile */ }
  apply(on);
}

export const isCrtOn = () => !document.body.classList.contains('crt-off');

export function setCrt(on) {
  apply(on);
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* ignora */ }
}

export function toggleCrt() { setCrt(!isCrtOn()); }
