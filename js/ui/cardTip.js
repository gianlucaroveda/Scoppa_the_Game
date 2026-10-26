// Descrizione di una carta in un fumetto: al passaggio del mouse, oppure tenendo premuto (touch).
// Funziona su qualsiasi elemento con data-def="<id carta>". Stili: css/effects.css (.card-tip)
import { getCardDef } from '../game/cards/cardDefs.js';
import { escapeHtml } from '../utils.js';

const TYPE_LABEL = { attack: 'Attacco', defense: 'Difesa', spell: 'Magia', trap: 'Trappola' };
const HOLD_MS = 350;      // quanto tenere premuto su touch
const MOVE_TOLERANCE = 10; // px di spostamento che annullano la pressione lunga (es. scroll della mano)

let tip = null, current = null, holdTimer = null, holdShown = false, suppressClick = false, startX = 0, startY = 0, inited = false;

function ensureTip() {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'card-tip hidden';
    document.body.appendChild(tip);
  }
  return tip;
}

function place(cardEl) {
  const r = cardEl.getBoundingClientRect();
  const w = tip.offsetWidth, h = tip.offsetHeight, m = 8;
  const left = Math.max(m, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - m));
  let top = r.top - h - m;                                  // di solito sopra la carta...
  if (top < m) top = Math.min(r.bottom + m, window.innerHeight - h - m); // ...sotto se non c'è spazio
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function show(cardEl) {
  const def = getCardDef(cardEl.dataset.def);
  if (!def) return;
  current = cardEl;
  ensureTip().innerHTML = `
    <div class="card-tip__head"><span class="card-tip__name">${escapeHtml(def.name)}</span><span class="card-tip__cost">${def.cost}</span></div>
    <div class="card-tip__type card-tip__type--${def.type}">${TYPE_LABEL[def.type] || def.type}${def.passive ? ' · passiva' : ''}</div>
    <div class="card-tip__text">${escapeHtml(def.text)}</div>`;
  tip.classList.remove('hidden');
  place(cardEl);
}

function hide() {
  current = null;
  if (tip) tip.classList.add('hidden');
}

function endHold() {
  clearTimeout(holdTimer);
  if (holdShown) { hide(); suppressClick = true; setTimeout(() => { suppressClick = false; }, 400); }
  holdShown = false;
}

export function initCardTip() {
  if (inited) return;
  inited = true;

  // mouse: hover
  document.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const c = e.target.closest?.('[data-def]');
    if (c) { if (c !== current) show(c); } else hide();
  });
  document.documentElement.addEventListener('mouseleave', hide);

  // touch: tieni premuto
  document.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    const c = e.target.closest?.('[data-def]');
    clearTimeout(holdTimer);
    holdShown = false;
    if (!c) { hide(); return; }
    startX = e.clientX; startY = e.clientY;
    holdTimer = setTimeout(() => { show(c); holdShown = true; }, HOLD_MS);
  });
  document.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse' || holdShown) return;
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_TOLERANCE) clearTimeout(holdTimer);
  });
  document.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') endHold(); });
  document.addEventListener('pointercancel', e => { if (e.pointerType !== 'mouse') endHold(); });

  // dopo una pressione lunga il rilascio non deve contare come clic (altrimenti la carta verrebbe selezionata)
  document.addEventListener('click', e => {
    if (!suppressClick) return;
    suppressClick = false;
    e.stopPropagation(); e.preventDefault();
  }, true);
  document.addEventListener('contextmenu', e => { if (e.target.closest?.('[data-def]')) e.preventDefault(); });

  // la mano viene ridisegnata spesso: se la carta sotto il fumetto sparisce, lo nascondiamo
  setInterval(() => { if (current && !current.isConnected) hide(); }, 250);
}
