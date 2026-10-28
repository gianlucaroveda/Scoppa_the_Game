import { state } from '../state.js';
import { PHASES, DRAW_FLIGHT_MS, DRAW_STAGGER_MS, CARD_OVERLAY_MS, CARD_OVERLAY_MULTI_MS } from '../config.js';
import { PHASE_BANNER_MS } from '../settings.js';
import { getCardDef } from '../game/cards/cardDefs.js';
import { cardFaceHTML } from './cardFace.js';
import { renderMyHand } from './render.js';
import { playSound } from './sound.js';

/* ---------- coda: le animazioni vanno una alla volta, nell'ordine di arrivo ---------- */
const queue = [];
let running = false;

function enqueue(job) {
  queue.push(job);
  if (!running) runQueue();
}
async function runQueue() {
  running = true;
  while (queue.length) {
    try { await queue.shift()(); } catch (e) { console.error('Animazione fallita:', e); }
  }
  running = false;
}
const wait = ms => new Promise(r => setTimeout(r, ms));

/* ---------- overlay carta attivata / distrutta ---------- */

export function showCardAnimation(payloadOrDefId, message = '') {
  const payload = typeof payloadOrDefId === 'string'
    ? { mode: 'activate', message, cards: [{ defId: payloadOrDefId }] }
    : payloadOrDefId;
  enqueue(() => playCardOverlay(payload));
}

const FX_BADGES = {
  damage: ['💔', 'fx-badge--damage'],
  heal:   ['💚', 'fx-badge--heal'],
  info:   ['⚔️', 'fx-badge--info'],
  poison: ['☠️', 'fx-badge--poison'],
  safe:   ['🛡️', 'fx-badge--heal'],   // schivato / già al massimo (nessun suono)
};

async function playCardOverlay(payload) {
  const { mode = 'activate', message = '', cards = [] } = payload || {};
  if (!cards.length) return;
  const isDestroy = mode === 'destroy';

  // Suoni sincronizzati con l'animazione: carta giocata / distrutta, poi danno e/o cura mostrati nei badge
  playSound(isDestroy ? 'destroyCard' : 'playCard');
  const kinds = new Set(cards.flatMap(c => (c.effects || []).map(e => e.type)));
  let delay = 350;
  if (kinds.has('damage')) { setTimeout(() => playSound('damage'), delay); delay += 350; }
  if (kinds.has('heal')) setTimeout(() => playSound('heal'), delay);

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `<div class="overlay__title ${isDestroy ? 'overlay__title--destroy' : ''}"></div><div class="overlay__grid"></div>`;
  overlay.firstChild.innerText = message;
  const grid = overlay.lastChild;

  cards.forEach(item => {
    const def = getCardDef(item.defId);
    if (!def) return;
    const wrap = document.createElement('div');
    wrap.className = 'overlay__item';
    wrap.innerHTML = `<div class="card card--overlay ${isDestroy ? 'card--destroy' : 'card--activate'}">${cardFaceHTML(def)}</div>`;
    const caption = document.createElement('div');
    caption.className = 'overlay__text';
    caption.textContent = def.text;
    wrap.appendChild(caption);
    (item.effects || []).forEach(eff => {
      const [icon, cls] = FX_BADGES[eff.type] || FX_BADGES.info;
      const badge = document.createElement('div');
      badge.className = `fx-badge ${cls}`;
      badge.textContent = `${icon} ${eff.text}`;
      wrap.appendChild(badge);
    });
    grid.appendChild(wrap);
  });

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-visible'));
  await wait(isDestroy && cards.length > 1 ? CARD_OVERLAY_MULTI_MS : CARD_OVERLAY_MS);
  overlay.classList.remove('is-visible');
  await wait(300);
  overlay.remove();
}

/* ---------- animazione di pesca ---------- */

export function showDrawAnimation(payload) {
  enqueue(() => playDraw(payload));
}

function revealCard(uid) {
  state.ui.revealing[uid] = Date.now();
  state.ui.hiddenUids = state.ui.hiddenUids.filter(u => u !== uid); // ora la carta compare nella mano
  renderMyHand();
}

async function playDraw({ playerId, count, uids }) {
  const mine = playerId === state.peerId;
  // le carte da mostrare sono quelle indicate dall'host (fallback: le prime nascoste)
  const revealUids = mine ? (uids ?? state.ui.hiddenUids.slice(0, count)) : [];
  const deckEl = document.querySelector('[data-action="playerDrawCard"]');
  const targetEl = mine ? document.getElementById('my-hand')
                        : document.querySelector(`[data-player-id="${CSS.escape(playerId)}"]`);

  if (!deckEl || !targetEl) { revealUids.forEach(revealCard); return; }

  const from = deckEl.getBoundingClientRect();
  const to = targetEl.getBoundingClientRect();

  // Se siamo noi, puntiamo alla destra della nostra mano (to.right - 60px), altrimenti al centro dell'avversario
  const targetX = mine ? (to.right - 60) : (to.left + to.width / 2);
  const targetY = to.top + to.height / 2;

  const dx = targetX - (from.left + from.width / 2);
  const dy = targetY - (from.top + from.height / 2);

  // Animazione più veloce per la prima persona
  const duration = mine ? 220 : DRAW_FLIGHT_MS;
  const stagger = mine ? 50 : DRAW_STAGGER_MS;

  const flights = [];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'card-back fly-card';
    setTimeout(() => playSound('draw'), i * stagger); // un suono per ogni carta, quando parte il suo volo
    document.body.appendChild(el);
    el.style.left = `${from.left + from.width / 2 - el.offsetWidth / 2}px`;
    el.style.top = `${from.top + from.height / 2 - el.offsetHeight / 2}px`;

    const anim = el.animate([
      { transform: 'translate(0,0) rotate(0deg) scale(1)' },
      { transform: `translate(${dx}px,${dy}px) rotate(${mine ? 0 : 12}deg) scale(${mine ? 1.4 : 0.6})` },
    ], { 
      duration, 
      delay: i * stagger, 
      easing: mine ? 'cubic-bezier(.1, .9, .2, 1)' : 'cubic-bezier(.2,.8,.2,1)', 
      fill: 'both' 
    });

    flights.push(anim.finished.catch(() => {}).then(() => {
      el.remove();
      if (revealUids[i] !== undefined) revealCard(revealUids[i]);
    }));
  }
  await Promise.all(flights);
}

/* ---------- scritte di fase: SOLO per chi è di turno (inizio, attacco, fine turno) ---------- */

let lastPhaseKey = null, lastTurnNumber = 0, lastTurnOwner = null;
const BANNER_PHASES = [PHASES.START, PHASES.ATTACK, PHASES.ATTACK_PICK];
const nameOf = id => (state.roomPlayers[id]?.name ?? '?').toUpperCase();
// di chi è il turno (durante un contrattacco resta il primo attaccante)
const turnOwnerId = g => g.counter?.originalPlayerId ?? g.currentPlayerId;

function phaseKey() {
  const g = state.game;
  return [g.phase, g.currentPlayerId, g.turnNumber, g.pendingAttack?.attackerId, g.pendingAttack?.targetId, g.counter ? 'c' : ''].join('|');
}

// Testo della scritta; null = niente da mostrare a questo giocatore.
function describePhase() {
  const g = state.game;
  const me = state.peerId;
  const a = g.pendingAttack || {};
  switch (g.phase) {
    case PHASES.START:
      return g.currentPlayerId === me ? { cls: 'start', title: 'PESCA O ATTIVA UNA CARTA', sub: 'Il tuo turno' } : null;
    case PHASES.ATTACK:
      return g.currentPlayerId === me ? { cls: 'attack', title: 'ATTACCA!', sub: 'Clicca un giocatore e scegli che carta distruggere' } : null;
    case PHASES.ATTACK_PICK: // solo il contrattacco (l'attacco normale è già stato annunciato da ATTACK)
      return g.counter && a.attackerId === me ? { cls: 'pick', title: 'CONTRATTACCO!', sub: `Scegli la carta da distruggere a ${nameOf(a.targetId)}` } : null;
    default:
      return null;
  }
}

// Da chiamare a ogni render: mostra la scritta solo quando fase / turno cambiano davvero.
export function announcePhaseChange() {
  const g = state.game;
  if (g.phase === PHASES.LOBBY || g.phase === PHASES.AVATAR_SELECT) {
    lastPhaseKey = null; lastTurnNumber = 0; lastTurnOwner = null;
    return;
  }

  // FINE TURNO: compare a chi aveva il turno quando il turno passa a un altro
  if (g.turnNumber > lastTurnNumber) {
    if (lastTurnNumber > 0 && lastTurnOwner === state.peerId) {
      const next = g.phase === PHASES.GAME_OVER ? '' : `Tocca a ${nameOf(g.currentPlayerId)}`;
      enqueue(() => playPhaseBanner({ cls: 'end', title: 'FINE TURNO', sub: next }));
    }
    lastTurnNumber = g.turnNumber;
  }
  lastTurnOwner = turnOwnerId(g);

  if (!BANNER_PHASES.includes(g.phase)) { lastPhaseKey = null; return; }
  const key = phaseKey();
  if (key === lastPhaseKey) return;
  lastPhaseKey = key;
  if (!describePhase()) return; // non è la tua scritta
  enqueue(async () => {
    if (phaseKey() !== key) return; // nel frattempo la partita è andata avanti: salta la scritta vecchia
    const info = describePhase();
    if (info) await playPhaseBanner(info);
  });
}

// Animazione al centro dello schermo, come l'overlay delle carte attivate, ma neon e con sfondo trasparente.
// Davanti a tutto, sotto il filtro CRT. Il posizionamento è anche inline, così non dipende dal CSS.
async function playPhaseBanner({ cls, title, sub }) {
  const el = document.createElement('div');
  el.className = `phase-banner phase-banner--${cls}`;
  
  // Sfondo scuro a tutto schermo (rgba 8,4,16,0.82): fa risaltare la scritta. Più in basso con padding-top: 15vh (regolabile).
  el.style.cssText = 'position:fixed;inset:0;z-index:9500;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;padding-top:15vh;background:rgba(8,4,16,0.82);';
  
  // Testo molto grande (3.5rem per il titolo) con testo bianco e ombra nera discreta ma definita
  const titleStyle = 'color:#ffffff;font-size:3.5rem;font-weight:800;text-shadow:2px 2px 4px rgba(0,0,0,0.8);line-height:1.1;text-align:center;';
  const subStyle = 'color:#ffffff;font-size:1.8rem;font-weight:600;text-shadow:1.5px 1.5px 3px rgba(0,0,0,0.8);margin-top:8px;text-align:center;';

  el.innerHTML = `<div class="phase-banner__title" style="${titleStyle}"></div><div class="phase-banner__rule"></div><div class="phase-banner__sub" style="${subStyle}"></div>`;
  el.querySelector('.phase-banner__title').textContent = title;
  const subEl = el.querySelector('.phase-banner__sub');
  subEl.textContent = sub || '';
  if (!sub) subEl.style.display = 'none';
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  await wait(Math.max(300, PHASE_BANNER_MS - 300));
  el.classList.replace('is-in', 'is-out');
  await wait(300);
  el.remove();
}

/* ---------- eliminazioni ---------- */

const knownOut = new Set();

// Da chiamare a ogni render: annuncia (una volta) ogni giocatore appena eliminato.
export function announceEliminations() {
  const g = state.game;
  if (g.phase === PHASES.LOBBY || g.phase === PHASES.AVATAR_SELECT) { knownOut.clear(); return; }
  Object.entries(state.roomPlayers).forEach(([id, p]) => {
    if (!p.eliminated || knownOut.has(id)) return;
    knownOut.add(id);
    const mine = id === state.peerId;
    enqueue(() => playPhaseBanner(mine
      ? { cls: 'out', title: 'SEI ELIMINATO!', sub: 'Puoi restare a guardare la partita' }
      : { cls: 'out', title: `${(p.name ?? '?').toUpperCase()} ELIMINATO!`, sub: 'Fuori dal gioco' }));
  });
}
