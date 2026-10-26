// Attiva/disattiva l'effetto CRT (css/crt.css). La scelta viene ricordata.
const KEY = 'crt';

function apply(on) { document.body.classList.toggle('crt-off', !on); }

export function initCrt() {
  let on = true;
  try { on = localStorage.getItem(KEY) !== 'off'; } catch { /* storage non disponibile */ }
  apply(on);
}

export function toggleCrt() {
  const turnOn = document.body.classList.contains('crt-off');
  apply(turnOn);
  try { localStorage.setItem(KEY, turnOn ? 'on' : 'off'); } catch { /* ignora */ }
}
