// Tutto il rendering del DOM. Legge lo stato, non lo modifica. Gli stili sono in css/ (nessuna classe Tailwind).
import { state } from '../state.js';
import { PHASES, REVEAL_MS } from '../config.js';
import { getCardDef } from '../game/cards/cardDefs.js';
import { AVATARS, getAvatar, avatarHTML, playerSelectAvatar } from '../game/avatars.js';
import { myContext, canIPlay, playerPickTarget, playerTogglePick } from '../game/turns.js';
import { playerClickCard, playerDrawCard } from '../game/deck.js';
import { syncView } from './views.js';
import { escapeHtml } from '../utils.js';
import { cardFaceHTML, cardReadHTML } from './cardFace.js';
import { announcePhaseChange, announceEliminations } from './animations.js';
import { ensureEffectsCss } from './styles.js';

ensureEffectsCss();

export { escapeHtml }; // compatibilità: altri file possono ancora importarlo da qui

const $ = id => document.getElementById(id);
const playerName = id => escapeHtml(state.roomPlayers[id]?.name ?? '?');

export function renderAll() {
  initDeselect(); // una volta sola
  // inizializzazione difensiva di state.ui
  if (!state.ui) state.ui = {};
  if (!Array.isArray(state.ui.hiddenUids)) state.ui.hiddenUids = [];
  if (!state.ui.revealing) state.ui.revealing = {};
  if (!Array.isArray(state.ui.destroyPicks)) state.ui.destroyPicks = [];

  syncView();
  if (!myContext().canAct) state.ui.cardPick = null;
  if (!state.myHand.some(c => c.uid === state.ui.selectedCard)) state.ui.selectedCard = null;
  if (!(state.game.phase === PHASES.ATTACK_PICK && myContext().active)) state.ui.destroyPicks = [];

  renderDeckCount();
  renderPlayersGrid();
  renderTurnBar();
  renderOpponentsInGame();
  renderPlayedTableCard();
  renderMyHand();
  renderAvatarPicker();
  renderGameOver();
  announceEliminations();
  announcePhaseChange();
}

/* ---------- carte in mano ---------- */

// 1° clic su una carta: si alza e mostra l'effetto. 2° clic: la gioca. Clic su qualsiasi altra cosa: torna la copertina.
const FLIP_MS = 250;
let deselectInited = false;
function initDeselect() {
  if (deselectInited) return;
  deselectInited = true;
  document.addEventListener('click', e => {
    if (e.target.closest?.('[data-hand]')) return;               // clic su una carta della mano: lo gestisce playerClickCard
    if (!state.ui?.selectedCard && !state.ui?.cardPick) return;  // (un avversario cliccato come bersaglio ha già consumato la selezione)

    // Sotto attacco: carta difensiva selezionata (1 clic) e poi clic FUORI = non la uso, l'attacco prosegue.
    // (Se il clic è sul mazzo, ci pensa già il mazzo.)
    const sel = state.myHand.find(c => c.uid === state.ui.selectedCard);
    const declineDefense = myContext().defender && getCardDef(sel?.defId)?.type === 'defense'
      && !e.target.closest?.('[data-action="playerDrawCard"]');

    state.ui.selectedCard = null;
    state.ui.cardPick = null;
    renderAll();
    if (declineDefense) playerDrawCard();
  });
}

export function renderMyHand() {
  const container = $('my-hand');
  if (!container) return;

  const handCount = $('hand-count');
  if (handCount) handCount.innerText = state.myHand.length;
  const me = state.roomPlayers[state.peerId];
  $('my-stats').innerHTML = me
    ? (me.eliminated
        ? `${avatarHTML(me.avatarId, 'sm')}<span>💀 ELIMINATO</span>`
        : `${avatarHTML(me.avatarId, 'sm')}<span>♥ ${me.hp}</span><span>★ ${me.points}</span>${me.poison > 0 ? `<span class="status status--poison" title="Avvelenato: danni e cure x2">☠ ${me.poison}</span>` : ''}`)
    : '';
  container.closest('.me')?.classList.toggle('me--out', !!me?.eliminated);
  // la mano viene ridisegnata spesso: ricordo lo scroll del testo della carta aperta per non farlo tornare in cima
  const openCard = container.querySelector('.card--reading');
  const keepScroll = openCard ? { uid: openCard.dataset.uid, top: openCard.querySelector('.card__text')?.scrollTop ?? 0 } : null;
  container.innerHTML = '';

  if (state.myHand.length === 0) {
    container.innerHTML = '<div class="hand__empty">La tua mano è vuota.</div>';
    return;
  }

  const g = state.game;
  const now = Date.now();
  state.myHand.forEach(card => {
    const def = getCardDef(card.defId);
    const playable = def && canIPlay(card);
    const targeted = g.phase === PHASES.DEFENSE && g.pendingAttack?.targetId === state.peerId && g.pendingAttack.cardUids?.includes(card.uid);
    const selected = state.ui.selectedCard === card.uid || state.ui.cardPick === card.uid;
    const hidden = state.ui.hiddenUids.includes(card.uid);
    const revealedAt = state.ui.revealing[card.uid];
    const revealing = revealedAt && now - revealedAt < REVEAL_MS;
    const flipping = selected && state.ui.selectedAt && now - state.ui.selectedAt < FLIP_MS;

    const el = document.createElement('div');
    el.className = ['card',
      playable ? 'card--playable' : targeted ? '' : 'card--disabled',
      selected && 'card--selected', targeted && 'card--targeted',
      selected && 'card--reading', flipping && 'card--flip',
      hidden && 'card--hidden', revealing && 'card--reveal'].filter(Boolean).join(' ');
    // un re-render non deve far ripartire le animazioni
    if (revealing) el.style.animationDelay = `-${now - revealedAt}ms`;
    else if (flipping) el.style.animationDelay = `-${now - state.ui.selectedAt}ms`;
    el.dataset.hand = '1'; // riconosce i clic sulla mano (vedi initDeselect)
    el.dataset.uid = card.uid;
    el.onclick = () => playerClickCard(card);
    const defending = !!playable && g.phase === PHASES.DEFENSE && def?.type === 'defense';
    el.innerHTML = selected ? cardReadHTML(card, !!playable, defending) : cardFaceHTML(card);
    container.appendChild(el);
    if (selected && keepScroll && String(keepScroll.uid) === String(card.uid)) {
      const t = el.querySelector('.card__text');
      if (t) t.scrollTop = keepScroll.top;
    }
  });
}

export function renderPlayedTableCard() {
  const container = $('played-pile');
  if (!container) return;
  const emptyText = $('empty-table-text');
  let el = container.querySelector('.played-card-item');

  if (!state.playedTableCard) {
    if (emptyText) emptyText.style.display = 'block';
    if (el) el.remove();
    return;
  }

  if (emptyText) emptyText.style.display = 'none';
  if (!el) {
    el = document.createElement('div');
    el.className = 'card card--table played-card-item';
    container.appendChild(el);
  }
  el.innerHTML = cardFaceHTML(state.playedTableCard);
}

export function renderDeckCount() {
  const n = state.isHost ? state.masterDeck.length : (state.deckCount ?? 0);
  const el = $('deck-count');
  if (el) el.innerText = `${n} carte`;
}

/* ---------- lobby ---------- */

export function renderPlayersGrid() {
  const grid = $('players-grid');
  if (!grid) return;
  const players = Object.entries(state.roomPlayers);
  const badge = $('player-count-badge');
  if (badge) badge.innerText = players.length;

  if (players.length === 0) {
    grid.innerHTML = '<div class="slot slot--empty">Non sei collegato a nessuna stanza.<br>Crea una stanza o inserisci un ID.</div>';
    return;
  }

  grid.innerHTML = '';
  players.forEach(([pId, p], i) => {
    const isMe = pId === state.peerId;
    const slot = document.createElement('div');
    slot.className = `slot ${isMe ? 'slot--me' : ''} ${p.isHost ? 'slot--host' : ''}`;
    slot.innerHTML = `
      <div class="slot__tag">${p.isHost ? '<i class="fa-solid fa-crown"></i>' : 'P' + (i + 1)}</div>
      <div class="slot__info">
        <div class="slot__name">${escapeHtml(p.name)}${isMe ? ' (Tu)' : ''}</div>
        <div class="slot__id">ID: ${escapeHtml(pId)}</div>
      </div>`;
    grid.appendChild(slot);
  });
}

/* ---------- scelta avatar ---------- */

export function renderAvatarPicker() {
  if (state.game.phase !== PHASES.AVATAR_SELECT) return;
  const players = Object.entries(state.roomPlayers);
  const chosen = players.filter(([, p]) => p.avatarId).length;
  const statusEl = $('avatar-status');
  if (statusEl) statusEl.textContent = `Hanno scelto ${chosen} su ${players.length}. La partita parte quando hanno scelto tutti.`;

  const grid = $('avatar-grid');
  if (!grid) return;
  grid.innerHTML = '';
  AVATARS.forEach(a => {
    const owner = players.find(([, p]) => p.avatarId === a.id);
    const mine = owner && owner[0] === state.peerId;
    const taken = owner && !mine;
    const btn = document.createElement('button');
    btn.disabled = !!taken;
    btn.className = `avatar-btn ${mine ? 'avatar-btn--mine' : ''}`;
    btn.innerHTML = `${avatarHTML(a.id, 'xl')}
      <span class="avatar-btn__name">${a.name}</span>
      <span class="avatar-btn__owner">${owner ? escapeHtml(owner[1].name) : ''}</span>`;
    btn.onclick = () => playerSelectAvatar(a.id);
    grid.appendChild(btn);
  });
}

/* ---------- tavolo: ordine di gioco, fase, avversari ---------- */

export function renderTurnBar() {
  const g = state.game;
  const ctx = myContext();

  const turnOrderEl = $('turn-order');
  if (turnOrderEl) {
    turnOrderEl.innerHTML = (g.turnOrder || []).map((id, i) => {
      const p = state.roomPlayers[id];
      if (!p) return '';
      const cls = ['chip', id === g.currentPlayerId && 'chip--current', p.eliminated && 'chip--out'].filter(Boolean).join(' ');
      return `<div class="${cls}"><span class="chip__n">${i + 1}</span>${avatarHTML(p.avatarId, 'sm')}<span>${escapeHtml(p.name)}${id === state.peerId ? ' (Tu)' : ''}</span></div>`; // chip--out mostra 💀 via CSS
    }).join('<span class="chip-sep">▸</span>');
  }

  const a = g.pendingAttack || {};
  let hint = '';
  switch (g.phase) {
    case PHASES.START:
      hint = ctx.active ? '🟢 Il tuo turno · pesca una carta (clicca il mazzo) oppure attiva una carta'
                        : `Turno di ${playerName(g.currentPlayerId)} · fase di inizio`;
      break;
    case PHASES.ATTACK:
      hint = ctx.active ? '⚔️ Attacco: clicca un giocatore e scegli che carta distruggere'
                        : `${playerName(g.currentPlayerId)} sta scegliendo il bersaglio`;
      break;
    case PHASES.ATTACK_PICK: {
      const n = a.destroyCount === 1 ? 'la carta' : `${a.destroyCount} carte (${state.ui.destroyPicks.length}/${a.destroyCount})`;
      hint = ctx.active ? `🎯 Scegli ${n} da distruggere dalla mano di ${playerName(a.targetId)} (carte coperte)`
                        : `${playerName(a.attackerId)} sta scegliendo cosa distruggere a ${playerName(a.targetId)}`;
      break;
    }
    case PHASES.DEFENSE: {
      const canDefend = ctx.defender && state.myHand.some(c => getCardDef(c.defId)?.type === 'defense');
      const n = a.destroyCount === 1 ? 'la carta evidenziata' : 'le carte evidenziate';
      hint = !ctx.defender ? `${playerName(a.targetId)} si difende dall'attacco di ${playerName(a.attackerId)}`
        : canDefend ? `🛡️ ${playerName(a.attackerId)} ha preso di mira ${n}. Hai una carta difensiva: doppio clic per attivarla e annullare l'attacco, oppure un clic sulla carta e poi fuori per non usarla`
                    : `💥 ${playerName(a.attackerId)} ha preso di mira ${n}. Verranno distrutte e ne pescherai ${a.destroyCount === 1 ? 'una' : a.destroyCount} in automatico...`;
      break;
    }
    case PHASES.GAME_OVER:
      hint = 'Partita terminata';
      break;
  }
  const phaseHintEl = $('phase-hint');
  if (phaseHintEl) phaseHintEl.innerHTML = hint;

}

export function renderOpponentsInGame() {
  const g = state.game;
  const ctx = myContext();
  const container = $('opponents-game-container');
  if (!container) return;
  container.innerHTML = '';
  const picking = (g.phase === PHASES.ATTACK && ctx.active) || !!state.ui.cardPick;

  Object.entries(state.roomPlayers).forEach(([pId, p]) => {
    if (pId === state.peerId) return;

    const targetable = picking && !p.eliminated;
    const pickingCards = g.phase === PHASES.ATTACK_PICK && ctx.active && g.pendingAttack?.targetId === pId;
    const underAttack = g.phase === PHASES.DEFENSE && g.pendingAttack?.targetId === pId;

    const opp = document.createElement('div');
    opp.className = ['opp',
      underAttack ? 'opp--attacked' : g.currentPlayerId === pId && 'opp--turn',
      p.eliminated && 'opp--out', p.poison > 0 && 'opp--poison', targetable && 'opp--targetable', pickingCards && 'opp--picking'].filter(Boolean).join(' ');
    opp.dataset.playerId = pId; // destinazione del volo della pesca (ui/animations.js)
    if (targetable) opp.onclick = () => playerPickTarget(pId);

    let cardsVisual = '';
    if (pickingCards) { // carte coperte cliccabili: l'attaccante sceglie quale distruggere
      for (let i = 0; i < p.handCount; i++) {
        const sel = state.ui.destroyPicks.includes(i);
        cardsVisual += `<button data-pick="${i}" class="card-back card-back--pick ${sel ? 'is-selected' : ''}"></button>`;
      }
    } else {
      for (let i = 0; i < Math.min(p.handCount, 5); i++) cardsVisual += '<div class="card-back card-back--mini"></div>';
    }

    opp.innerHTML = `
      ${avatarHTML(p.avatarId, 'md')}
      <div class="opp__name">${p.isHost ? '<i class="fa-solid fa-crown"></i>' : ''}${escapeHtml(p.name)}</div>
      <div class="opp__hand">${p.eliminated ? '<span class="opp__empty">💀</span>' : p.handCount > 0 ? cardsVisual : '<span class="opp__empty">Mano vuota</span>'}</div>
      <span class="opp__count">${p.eliminated ? 'fuori dal gioco' : `${p.handCount} carte`}</span>
      <span class="opp__stats">♥ ${p.hp} PV · ★ ${p.points}</span>
      ${p.poison > 0 ? `<span class="status status--poison">☠ veleno ${p.poison}</span>` : ''}`;
    if (pickingCards) opp.querySelectorAll('[data-pick]').forEach(b => { b.onclick = () => playerTogglePick(Number(b.dataset.pick)); });
    container.appendChild(opp);
  });

  if (container.children.length === 0) {
    container.innerHTML = '<div class="opps__wait">In attesa di altri giocatori...</div>';
  }
}

export function renderGameOver() {
  const g = state.game;
  const over = g.phase === PHASES.GAME_OVER;
  const gameOverEl = $('game-over');
  if (gameOverEl) gameOverEl.classList.toggle('hidden', !over);
  if (over) {
    const w = state.roomPlayers[g.winnerId];
    const winnerText = $('winner-text');
    if (winnerText) {
      winnerText.innerHTML = w ? `${avatarHTML(w.avatarId, 'lg')}<span></span>` : '<span></span>';
      winnerText.querySelector('span:last-child').textContent = w ? `${w.name} vince!` : 'Pareggio: nessun superstite';
    }
  }
}
