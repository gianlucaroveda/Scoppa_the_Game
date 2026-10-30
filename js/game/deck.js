// ===== MAZZO, MANI E CARTE GIOCATE =====
import { state } from '../state.js';
import { HAND_SIZE, PHASES, STARTING_HP } from '../config.js';
import { shuffle } from '../utils.js';
import { broadcastStateUpdate } from '../network/host.js';
import { renderAll, renderMyHand } from '../ui/render.js';
import { showToast } from '../ui/toast.js';
import { modifyByStatus } from './scoring.js';
import { DECK_LIST, getCardDef, cardNeedsTarget } from './cards/cardDefs.js';
import { resolveCardEffect } from './cards/effects.js';
import { myContext, canIPlay, isValidTarget, hostAfterStartAction, hostResolveUndefendedAttack } from './turns.js';
import { hostEndTurn } from './turns.js';
import { MSG, sendToPlayer, sendAction, notify, announce, broadcastCardAnimation, broadcastDrawAnimation } from '../network/protocol.js';

let nextUid = 1;

/* ---------- HOST: mazzo e mani ---------- */

export function generateMasterDeck() {
  state.masterDeck = [];
  state.discardPile = []; // carte giocate/distrutte (SOLO HOST): quando il mazzo finisce tornano a formare il nuovo mazzo
  for (const [defId, copies] of Object.entries(DECK_LIST)) {
    for (let i = 0; i < copies; i++) state.masterDeck.push({ uid: nextUid++, defId });
  }
  shuffle(state.masterDeck);
}

export function hostSyncHand(playerId, drawnUids = []) {
  if (!state.hands[playerId]) state.hands[playerId] = [];
  const hand = state.hands[playerId];
  if (state.roomPlayers[playerId]) state.roomPlayers[playerId].handCount = hand.length;
  if (playerId === state.peerId) {
    state.myHand = [...hand];
    if (!state.ui) state.ui = {};
    if (!Array.isArray(state.ui.hiddenUids)) state.ui.hiddenUids = [];
    state.ui.hiddenUids.push(...drawnUids);
    renderMyHand();
  } else {
    sendToPlayer(playerId, { type: MSG.MY_HAND, hand, drawn: drawnUids });
  }
}

export function drawCards(playerId, n, animate = true) {
  if (!state.hands[playerId]) state.hands[playerId] = [];
  const drawnUids = [];
  while (drawnUids.length < n) {
    if (state.masterDeck.length === 0) refillDeckFromDiscard(); // mazzo finito: si ricrea con gli scarti
    if (state.masterDeck.length === 0) break;                   // niente scarti: davvero finito
    const card = state.masterDeck.pop();
    state.hands[playerId].push(card);
    drawnUids.push(card.uid);
  }
  const drawn = drawnUids.length;
  hostSyncHand(playerId, animate ? drawnUids : []);
  if (drawn > 0 && animate) broadcastDrawAnimation({ playerId, count: drawn, uids: drawnUids }); // gli uid non rivelano il contenuto delle carte
  if (drawn > 0 && playerId === state.peerId) showToast(`Hai pescato ${drawn} carta/e`, 'success');
  return drawn;
}

// Distribuisce n carte a testa, ma NON a chi è eliminato.
export function hostDealHands(n, animate = false) {
  Object.entries(state.roomPlayers).forEach(([id, p]) => { if (!p.eliminated) drawCards(id, n, animate); });
}

export function hostClearHands() {
  state.hands = {};
  Object.keys(state.roomPlayers).forEach(id => hostSyncHand(id));
}

/* ---------- scarti e carte degli eliminati ---------- */

function discard(card) {
  if (!state.discardPile) state.discardPile = [];
  state.discardPile.push(card);
}

// Quando il mazzo è finito, tutte le carte giocate e distrutte vengono rimescolate e formano il nuovo mazzo.
// Le carte in mano ai giocatori non si toccano. Ritorna true se il mazzo è stato ricreato.
export function refillDeckFromDiscard() {
  const pile = state.discardPile || [];
  if (state.masterDeck.length > 0 || pile.length === 0) return false;
  state.masterDeck = shuffle(pile.splice(0, pile.length));
  announce(`🔀 Mazzo finito: ${state.masterDeck.length} carte scartate rimescolate nel nuovo mazzo`);
  return true;
}

// Un giocatore eliminato rimette le carte che aveva in mano nel mazzo (rimescolato).
// Si chiama dopo ogni effetto che può togliere PV (effects.js).
export function hostCollectEliminatedHands() {
  let moved = 0;
  Object.entries(state.roomPlayers).forEach(([id, p]) => {
    const hand = state.hands[id];
    if (!p.eliminated || !hand?.length) return;
    moved += hand.length;
    state.masterDeck.push(...hand);
    hand.length = 0;
    hostSyncHand(id);
  });
  if (moved) {
    shuffle(state.masterDeck);
    announce(`🔀 Le ${moved} carte dell'eliminato tornano nel mazzo`);
  }
}

/* ---------- riepilogo effetti per i badge dell'animazione ---------- */

// Ritorna [{ text, type }] con type = damage | heal | poison | info | safe. Calcolato PRIMA di applicare gli effetti.
function summarizeEffects(def, trigger, { ownerId, destroyerId, targetId }) {
  const name = id => state.roomPlayers[id]?.name ?? '?';
  const whoId = e => (e.target === 'self' || e.target === 'owner') ? ownerId : e.target === 'destroyer' ? destroyerId : e.target === 'opponent' ? targetId : null;
  const shielded = id => id !== undefined && id === destroyerId && !!state.game?.attackMods?.ignoreTraps; // Attacco Protetto
  const out = [];
  (def?.effects || []).filter(e => e.trigger === trigger).forEach(e => {
    const pid = whoId(e), who = name(pid);
    if (e.action === 'damage') {
      out.push(shielded(pid) ? { text: `${who} schiva il danno`, type: 'safe' }
                             : { text: `${who} -${modifyByStatus(pid, e.amount)} PV`, type: 'damage' });
    } else if (e.action === 'heal') {
      const hp = state.roomPlayers[pid]?.hp ?? STARTING_HP;
      const gain = Math.min(STARTING_HP - hp, modifyByStatus(pid, e.amount));
      out.push(gain > 0 ? { text: `${who} +${gain} PV`, type: 'heal' } : { text: `${who}: PV già al massimo`, type: 'safe' });
    } else if (e.action === 'poison') {
      out.push(shielded(pid) ? { text: `${who} schiva il veleno`, type: 'safe' } : { text: `${who} avvelenato!`, type: 'poison' });
    } else if (e.action === 'poisonAll') {
      out.push(trigger === 'onDestroy' && state.game?.attackMods?.ignoreTraps
        ? { text: 'Attacco Protetto: viene solo distrutta', type: 'safe' }
        : { text: 'Tutti i giocatori avvelenati!', type: 'poison' });
    } else if (e.action === 'counterAttack') {
      out.push({ text: `${name(ownerId)} contrattacca!`, type: 'info' });
    }
  });
  return out;
}

/* ---------- HOST: azioni dei giocatori ---------- */

export function hostHandleDraw(senderId) {
  const g = state.game;
  if (g.phase === PHASES.START && senderId === g.currentPlayerId) {
    if (drawCards(senderId, 1) === 0) announce('Mazzo esaurito: nessuna carta da pescare'); // senza carte si passa comunque avanti
    hostAfterStartAction();
  } else if (g.phase === PHASES.DEFENSE && g.pendingAttack?.targetId === senderId) {
    hostResolveUndefendedAttack();
  } else {
    return notify(senderId, 'Non puoi pescare adesso');
  }
  broadcastStateUpdate();
}

export function hostHandlePlayCard(senderId, data) {
  const g = state.game;
  const hand = state.hands[senderId] || [];
  const idx = hand.findIndex(c => c.uid === data.uid);
  const def = idx >= 0 ? getCardDef(hand[idx].defId) : null;
  if (!def) return;

  const inStart = g.phase === PHASES.START && senderId === g.currentPlayerId;
  const inDefense = g.phase === PHASES.DEFENSE && g.pendingAttack?.targetId === senderId;
  if (!inStart && !inDefense) return notify(senderId, 'Non puoi giocare carte adesso');
  if (def.passive) return notify(senderId, 'Questa carta agisce solo quando viene distrutta');
  if (inStart && def.type === 'defense') return notify(senderId, 'Le carte difensive si usano quando vieni attaccato');
  if (inDefense && def.type !== 'defense') return notify(senderId, 'Sotto attacco puoi giocare solo carte difensive');
  if (cardNeedsTarget(def) && !isValidTarget(senderId, data.targetId)) return notify(senderId, 'Scegli un bersaglio valido');

  const [card] = hand.splice(idx, 1);
  state.playedTableCard = card;
  discard(card);
  hostSyncHand(senderId);

  const playerName = state.roomPlayers[senderId]?.name ?? '?';
  announce(`${playerName} gioca ${def.name}`);

  broadcastCardAnimation({
    mode: 'activate',
    message: `${playerName} attiva ${def.name}!`,
    cards: [{ defId: def.id, effects: summarizeEffects(def, 'onPlay', { ownerId: senderId, targetId: data.targetId }) }]
  });

  resolveCardEffect(def, { ownerId: senderId, targetId: data.targetId });

  if (g.phase !== PHASES.GAME_OVER) {
    if (inStart) hostAfterStartAction();
    else hostEndTurn();
  }
  broadcastStateUpdate();
}

export function hostDestroyCards(ownerId, destroyerId, uids) {
  const hand = state.hands[ownerId] || [];
  const name = id => state.roomPlayers[id]?.name ?? '?';
  let destroyed = 0;

  const destroyedCardsPayload = [];

  for (const uid of uids) {
    const idx = hand.findIndex(c => c.uid === uid);
    if (idx < 0) continue;
    const [card] = hand.splice(idx, 1);
    discard(card);
    const def = getCardDef(card.defId);
    destroyed++;

    announce(`💥 ${def?.name ?? 'Una carta'} di ${name(ownerId)} viene distrutta da ${name(destroyerId)}`);

    const effectsSummary = summarizeEffects(def, 'onDestroy', { ownerId, destroyerId });

    if (def) {
      destroyedCardsPayload.push({
        defId: def.id,
        effects: effectsSummary
      });
    }

    hostSyncHand(ownerId);
    resolveCardEffect(def, { ownerId, destroyerId, trigger: 'onDestroy' });
    if (state.game.phase === PHASES.GAME_OVER || state.roomPlayers[ownerId]?.eliminated) break;
  }

  hostSyncHand(ownerId);

  if (destroyedCardsPayload.length > 0) {
    const ownerName = name(ownerId);
    const destroyerName = name(destroyerId);
    const msg = destroyedCardsPayload.length > 1
      ? `💥 ${destroyerName} distrugge ${destroyedCardsPayload.length} carte a ${ownerName}!`
      : `💥 ${destroyerName} distrugge una carta a ${ownerName}!`;

    broadcastCardAnimation({
      mode: 'destroy',
      message: msg,
      cards: destroyedCardsPayload
    });
  }

  return destroyed;
}

/* ---------- HOST: strumenti di test (pannello host) ---------- */

export function hostResetDeck() {
  if (!state.isHost) return;
  generateMasterDeck();
  state.playedTableCard = null;
  hostClearHands();
  broadcastStateUpdate();
  showToast('Mazzo e mani resettati!', 'info');
}

export function hostDealCards() {
  if (!state.isHost) return;
  hostDealHands(HAND_SIZE);
  broadcastStateUpdate();
}

/* ---------- giocatore locale (host o client) ---------- */

export function playerDrawCard() {
  if (!myContext().canAct) return showToast('Non puoi pescare adesso', 'error');
  sendAction({ type: MSG.DRAW_REQUEST });
}

export function playerPlayCard(uid, targetId) {
  sendAction({ type: MSG.PLAY_CARD, uid, targetId });
}

// 1° clic: la carta si alza e mostra il suo effetto (anche se ora non è giocabile, così la puoi leggere).
// 2° clic: la gioca (o chiede il bersaglio). Clic su altro: ui/render.js (initDeselect) la rimette a faccia "copertina".
export function playerClickCard(card) {
  const def = getCardDef(card.defId);
  if (!def) return;
  if (!state.ui) state.ui = {};

  if (state.ui.selectedCard !== card.uid) {
    state.ui.selectedCard = card.uid;
    state.ui.selectedAt = Date.now();
    state.ui.cardPick = null;
    renderAll();
    return;
  }

  if (!canIPlay(card)) {
    return showToast(def.passive ? 'Questa carta agisce solo quando viene distrutta' : 'Non puoi giocare questa carta adesso', 'error');
  }

  if (cardNeedsTarget(def)) {
    state.ui.cardPick = state.ui.cardPick === card.uid ? null : card.uid;
    if (state.ui.cardPick) showToast('Scegli un avversario come bersaglio');
    renderAll();
  } else {
    state.ui.selectedCard = null;
    playerPlayCard(card.uid);
  }
}
