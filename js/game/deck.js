// ===== MAZZO, MANI E CARTE GIOCATE =====
import { state } from '../state.js';
import { HAND_SIZE, PHASES } from '../config.js';
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
  while (drawnUids.length < n && state.masterDeck.length > 0) {
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

export function hostDealHands(n, animate = false) {
  Object.keys(state.roomPlayers).forEach(id => drawCards(id, n, animate));
}

export function hostClearHands() {
  state.hands = {};
  Object.keys(state.roomPlayers).forEach(id => hostSyncHand(id));
}

/* ---------- HOST: azioni dei giocatori ---------- */

export function hostHandleDraw(senderId) {
  const g = state.game;
  if (g.phase === PHASES.START && senderId === g.currentPlayerId) {
    if (state.masterDeck.length === 0) announce('Mazzo esaurito: nessuna carta da pescare');
    else drawCards(senderId, 1);
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
  hostSyncHand(senderId);

  const playerName = state.roomPlayers[senderId]?.name ?? '?';
  announce(`${playerName} gioca ${def.name}`);

  broadcastCardAnimation({
    mode: 'activate',
    message: `${playerName} attiva ${def.name}!`,
    cards: [{ defId: def.id }]
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
    const def = getCardDef(card.defId);
    destroyed++;

    announce(`💥 ${def?.name ?? 'Una carta'} di ${name(ownerId)} viene distrutta da ${name(destroyerId)}`);

    const effectsSummary = [];
    if (def?.effects) {
      def.effects.filter(e => e.trigger === 'onDestroy').forEach(e => {
        const targetPlayerId = e.target === 'owner' ? ownerId : e.target === 'destroyer' ? destroyerId : null;
        const targetName = name(targetPlayerId);

        if (e.action === 'damage') {
          if (targetPlayerId === destroyerId && state.game?.attackMods?.ignoreTraps) {
            effectsSummary.push({ text: `${targetName} schiva il danno`, type: 'heal' });
          } else {
            effectsSummary.push({ text: `${targetName} -${modifyByStatus(targetPlayerId, e.amount)} PV`, type: 'damage' });
          }
        } else if (e.action === 'heal') {
          effectsSummary.push({ text: `${targetName} +${modifyByStatus(targetPlayerId, e.amount)} PV`, type: 'heal' });
        } else if (e.action === 'poison') {
          if (targetPlayerId === destroyerId && state.game?.attackMods?.ignoreTraps) {
            effectsSummary.push({ text: `${targetName} schiva il veleno`, type: 'heal' });
          } else {
            effectsSummary.push({ text: `${targetName} avvelenato!`, type: 'poison' });
          }
        } else if (e.action === 'counterAttack') {
          effectsSummary.push({ text: `${name(ownerId)} contrattacca!`, type: 'info' });
        }
      });
    }

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
