// Menù impostazioni in alto a destra: volume master e effetto CRT. Markup in index.html (#btn-menu, #settings-panel).
import { getVolume, setVolume, playSound } from './sound.js';
import { isCrtOn, setCrt } from './crt.js';

export function initSettingsMenu() {
  const $ = id => document.getElementById(id);
  const btn = $('btn-menu'), panel = $('settings-panel');
  const range = $('volume-range'), label = $('volume-value'), crt = $('crt-toggle');
  if (!btn || !panel) return;

  const setOpen = open => panel.classList.toggle('hidden', !open);
  const isOpen = () => !panel.classList.contains('hidden');

  // valori iniziali
  range.value = Math.round(getVolume() * 100);
  label.textContent = `${range.value}%`;
  crt.checked = isCrtOn();

  btn.addEventListener('click', e => { e.stopPropagation(); setOpen(!isOpen()); });
  document.addEventListener('click', e => { if (isOpen() && !panel.contains(e.target)) setOpen(false); }); // clic fuori: chiude
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });

  range.addEventListener('input', () => { setVolume(range.value / 100); label.textContent = `${range.value}%`; });
  range.addEventListener('change', () => playSound('draw')); // anteprima del volume quando rilasci
  crt.addEventListener('change', () => setCrt(crt.checked));
}
