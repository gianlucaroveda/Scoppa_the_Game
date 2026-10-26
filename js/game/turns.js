// ===== TURNI E FLOW DI GIOCO =====
// Turno:  START (pesca OPPURE attiva una carta; con mazzo vuoto la pesca fa solo passare alla fase successiva) -> ATTACK (scegli bersaglio)
//         -> DEFENSE (il bersaglio pesca N carte OPPURE gioca una carta difensiva) -> fine turno.
// Le funzioni host* qui dentro NON fanno broadcast: lo fa chi le chiama (gli handler).
import { state } from '../state.js';
import { PHASES, HAND_SIZE, ATTACK_DESTROY_COUNT, MIN_PLAYERS, AUTO_RESOLVE_DELAY_MS } from '../config.js';
import { announce } from '../network/protocol.js';
import { shuffle } from '../utils.js';
import { MSG, sendAction, notify } from '../network/protocol.js';
import { broadcastStateUpdate } from '../network/host.js';
import { renderAll } from '../ui/render.js';
import { generateMasterDeck, hostClearHands, hostDealHands, hostDestroyCards, drawCards, playerPlayCard } from './deck.js';
import { allAvatarsChosen } from './avatars.js';
import { hostCheckVictory, hostPoisonPlayer, hostTickPoison, isPoisoned } from './scoring.js';
import { POISON_DURATION_TURNS } from '../settings.js';
import { getCardDef } from './cards/cardDefs.js';

/* ---------- query (usate anche dalla UI) ---------- */

export function myContext() {
  const g = state.game;
  const active = g.currentPlayerId === state.peerId;
  const defender = g.phase === PHASES.DEFENSE && g.pendingAttack?.targetId === state.peerId;
  return { active, defender, canAct: (g.phase === PHASES.START && active) || defender };
}

// Posso giocare questa carta adesso?
// START: tutto tranne difesa e passive. DEFENSE: qualsiasi carta difensiva che hai in mano (non serve che sia quella presa di mira).
export function canIPlay(card) {
  const def = getCardDef(card.defId);
  if (!def || def.passive) return false;
  const ctx = myContext();
  if (state.game.phase === PHASES.START && ctx.active) return def.type !== 'defense';
  if (ctx.defender) return def.type === 'defense';
  return false;
}

export function isValidTarget(attackerId, targetId) {
  const t = state.roomPlayers[targetId];
  return !!t && targetId !== attackerId && !t.eliminated;
}

function nextAlivePlayer(fromId) {
  const order = state.game.turnOrder;
  const idx = order.indexOf(fromId);
  for (let i = 1; i <= order.length; i++) {
    const id = order[(idx + i) % order.length];
    const p = state.roomPlayers[id];
    if (p && !p.eliminated) return id;
  }
  return null;
}

/* ---------- HOST: avvio partita ---------- */

// 1) il bottone "AVVIA PARTITA" porta tutti alla scelta avatar
export function hostStartAvatarSelection() {
  const g = state.game;
  g.phase = PHASES.AVATAR_SELECT;
  g.turnOrder = [];
  g.currentPlayerId = null;
  g.pendingAttack = null;
  g.winnerId = null;
  Object.values(state.roomPlayers).forEach(p => { p.avatarId = null; });
}

// 2) quando tutti hanno scelto: ordine casuale, mazzo, mani iniziali, parte il primo turno
export function hostBeginMatch() {
  const g = state.game;
  g.turnOrder = shuffle(Object.keys(state.roomPlayers));
  g.currentPlayerId = g.turnOrder[0];
  g.turnNumber = 1;
  g.pendingAttack = null;
  g.attackMods = { destroyCount: ATTACK_DESTROY_COUNT };
  g.counterAttack = null;
  g.counter = null;
  g.winnerId = null;
  g.phase = PHASES.START;
  state.playedTableCard = null;

  generateMasterDeck();
  hostClearHands();
  hostDealHands(HAND_SIZE);
}

/* ---------- HOST: transizioni di fase ---------- */

export function hostAfterStartAction() {
  state.game.phase = PHASES.ATTACK;
}

export function hostEndTurn() {
  const g = state.game;
  g.pendingAttack = null;
  g.counterAttack = null;
  g.attackMods = { destroyCount: ATTACK_DESTROY_COUNT }; // le modifiche valgono solo per il turno corrente

  // Fine di un contrattacco: si torna al turno di chi aveva attaccato per primo, che ora termina.
  if (g.counter) {
    const original = g.counter.originalPlayerId;
    g.counter = null;
    if (g.turnOrder.includes(original)) g.currentPlayerId = original;
  }

  // Veleno: ogni turno che finisce (di chiunque) scala il contatore personale
  hostTickPoison(g.turnNumber).forEach(id => announce(`☠️ ${state.roomPlayers[id]?.name ?? '?'} non è più avvelenato`));

  const next = nextAlivePlayer(g.currentPlayerId);
  if (!next) return;
  g.currentPlayerId = next;
  g.turnNumber++;
  g.phase = PHASES.START;
  // TODO: effetti "a inizio turno"
}

// Quante carte distrugge l'attacco: 1, salvo effetti attivati dall'attaccante nella fase di inizio (attackMod).
function computeDestroyedCards(attackerId, targetId) {
  return Math.max(0, state.game.attackMods.destroyCount);
}

// Il bersaglio non si è difeso e ha scelto di pescare: le carte prese di mira vengono distrutte
// (ognuna può attivare il suo effetto 'onDestroy'), poi ne pesca altrettante. Poi fine turno.
export function hostResolveUndefendedAttack() {
  const g = state.game;
  const { attackerId, targetId, cardUids } = g.pendingAttack;
  const victimId = contagionVictim(attackerId, targetId); // chi si contagerebbe, in base a chi è avvelenato PRIMA della distruzione
  const destroyed = hostDestroyCards(targetId, attackerId, cardUids);
  if (g.phase === PHASES.GAME_OVER) return;
  if (destroyed > 0) infect(victimId); // il veleno passa solo se una carta è stata davvero distrutta (non se l'attacco viene annullato)
  if (!state.roomPlayers[targetId]?.eliminated) drawCards(targetId, destroyed);
  if (!hostStartCounterAttack()) hostEndTurn();
}

// Una carta distrutta con l'effetto 'counterAttack' ha segnato g.counterAttack: il proprietario attacca a sua volta
// chi lo ha attaccato (si salta la scelta del bersaglio), poi finisce il turno dell'attaccante originale (vedi hostEndTurn).
// Ritorna true se il contrattacco è partito.
function hostStartCounterAttack() {
  const g = state.game;
  const c = g.counterAttack;
  g.counterAttack = null;
  if (!c) return false;

  const owner = state.roomPlayers[c.playerId];
  const victim = state.roomPlayers[c.targetId];
  if (!owner || !victim || owner.eliminated || victim.eliminated) return false;

  const handSize = (state.hands[c.targetId] || []).length;
  if (handSize === 0) { announce(`${owner.name} non può contrattaccare: ${victim.name} non ha carte`); return false; }

  if (!g.counter) g.counter = { originalPlayerId: g.currentPlayerId }; // in caso di catene resta il primo attaccante
  g.currentPlayerId = c.playerId;
  g.attackMods = { destroyCount: ATTACK_DESTROY_COUNT };
  g.pendingAttack = { attackerId: c.playerId, targetId: c.targetId, destroyCount: Math.min(ATTACK_DESTROY_COUNT, handSize), cardUids: null };
  g.phase = PHASES.ATTACK_PICK;
  announce(`⚔️ ${owner.name} contrattacca ${victim.name}!`);
  return true;
}

// Contagio: se UNO solo dei due è avvelenato (attaccante o bersaglio), l'altro si avvelena (contatore personale).
// Succede solo quando una carta viene distrutta (hostResolveUndefendedAttack). Con Attacco Protetto attivo
// (attackMods.ignoreTraps) il veleno non passa in nessuna direzione. Ritorna chi si contagerebbe (o null).
function contagionVictim(attackerId, targetId) {
  if (state.game.attackMods?.ignoreTraps) return null;
  const attackerSick = isPoisoned(attackerId), targetSick = isPoisoned(targetId);
  if (attackerSick === targetSick) return null;
  return attackerSick ? targetId : attackerId;
}

function infect(victimId) {
  const victim = state.roomPlayers[victimId];
  if (!victim || victim.eliminated || isPoisoned(victimId)) return;
  hostPoisonPlayer(victimId, POISON_DURATION_TURNS);
  announce(`☠️ ${victim.name} è stato avvelenato!`);
}

/* ---------- HOST: handler delle azioni ---------- */

// 1) l'attaccante sceglie il bersaglio
export function hostHandleAttackTarget(senderId, data) {
  const g = state.game;
  if (g.phase !== PHASES.ATTACK || senderId !== g.currentPlayerId) return notify(senderId, 'Non è il momento di attaccare');
  if (!isValidTarget(senderId, data.targetId)) return notify(senderId, 'Bersaglio non valido');

  const handSize = (state.hands[data.targetId] || []).length;
  const destroyCount = Math.min(computeDestroyedCards(senderId, data.targetId), handSize);
  if (destroyCount === 0) { // nessuna carta da distruggere (mano vuota o attacco neutralizzato da un effetto)
    announce(handSize === 0 ? 'Il bersaglio non ha carte in mano' : 'Attacco senza effetto');
    hostEndTurn();
  } else {
    g.pendingAttack = { attackerId: senderId, targetId: data.targetId, destroyCount, cardUids: null };
    g.phase = PHASES.ATTACK_PICK;
  }
  broadcastStateUpdate();
}

// 2) l'attaccante sceglie, a carte coperte, quali carte della mano del bersaglio distruggere (posizioni)
export function hostHandleAttackCards(senderId, data) {
  const g = state.game;
  const a = g.pendingAttack;
  if (g.phase !== PHASES.ATTACK_PICK || senderId !== g.currentPlayerId) return notify(senderId, 'Non è il momento di scegliere la carta');

  const hand = state.hands[a.targetId] || [];
  const idx = data.indices;
  const valid = Array.isArray(idx) && idx.length === a.destroyCount && new Set(idx).size === idx.length
    && idx.every(i => Number.isInteger(i) && i >= 0 && i < hand.length);
  if (!valid) return notify(senderId, 'Selezione non valida');

  a.cardUids = idx.map(i => hand[i].uid);
  g.phase = PHASES.DEFENSE; // si passa SEMPRE alla difesa, così l'attaccante non capisce se la carta era difensiva

  // Nessuna carta difensiva in mano al bersaglio: la distruzione parte da sola,
  // dopo un ritardo fisso (senza clic del bersaglio).
  // Se il bersaglio ha almeno una carta difensiva in mano può scegliere di giocarla: si aspetta la sua decisione.
  const canDefend = hand.some(c => getCardDef(c.defId)?.type === 'defense');
  if (!canDefend) scheduleAutoResolve(a);
  broadcastStateUpdate();
}

function scheduleAutoResolve(attack) {
  setTimeout(() => {
    const g = state.game;
    if (!state.isHost || g.phase !== PHASES.DEFENSE || g.pendingAttack !== attack) return; // già risolto o stanza chiusa
    hostResolveUndefendedAttack();
    broadcastStateUpdate();
  }, AUTO_RESOLVE_DELAY_MS);
}

// Un giocatore è uscito (già rimosso da roomPlayers): tiene in piedi la partita.
export function hostOnPlayerLeft(id) {
  const g = state.game;
  delete state.hands[id];
  const remaining = Object.keys(state.roomPlayers);

  if (g.phase === PHASES.LOBBY || g.phase === PHASES.GAME_OVER) return;

  if (g.phase === PHASES.AVATAR_SELECT) {
    if (remaining.length < MIN_PLAYERS) g.phase = PHASES.LOBBY;
    else if (allAvatarsChosen()) hostBeginMatch();
    return;
  }

  const wasCurrent = id === g.currentPlayerId;
  const wasDefender = g.pendingAttack?.targetId === id;
  const next = nextAlivePlayer(id);
  g.turnOrder = g.turnOrder.filter(x => x !== id);

  if (remaining.length < MIN_PLAYERS) {            // ne è rimasto uno solo: vince
    g.winnerId = remaining[0] ?? null;
    g.phase = PHASES.GAME_OVER;
  } else if (hostCheckVictory()) {
    return;
  } else if (wasCurrent && g.counter) {
    hostEndTurn(); // contrattacco interrotto: si chiude il turno dell'attaccante originale
  } else if (wasCurrent) {
    g.counterAttack = null;
    g.pendingAttack = null;
    g.currentPlayerId = next;
    g.turnNumber++;
    g.phase = PHASES.START;
  } else if (wasDefender) {
    hostEndTurn();
  }
}

/* ---------- giocatore locale ---------- */

// Click su un avversario: serve sia per scegliere il bersaglio d'attacco sia per le carte con bersaglio.
export function playerPickTarget(targetId) {
  const ctx = myContext();
  if (state.game.phase === PHASES.ATTACK && ctx.active) {
    sendAction({ type: MSG.ATTACK_TARGET, targetId });
  } else if (state.ui.cardPick) {
    const uid = state.ui.cardPick;
    state.ui.cardPick = null;
    state.ui.selectedCard = null;
    renderAll();
    playerPlayCard(uid, targetId);
  }
}

// Click su una carta coperta della mano del bersaglio. Quando ne hai scelte abbastanza, l'attacco parte.
export function playerTogglePick(index) {
  const g = state.game;
  const a = g.pendingAttack;
  if (g.phase !== PHASES.ATTACK_PICK || !myContext().active || !a) return;

  const picks = state.ui.destroyPicks;
  const k = picks.indexOf(index);
  if (k >= 0) picks.splice(k, 1); else picks.push(index);

  if (picks.length >= a.destroyCount) {
    const indices = picks.slice(0, a.destroyCount);
    state.ui.destroyPicks = [];
    sendAction({ type: MSG.ATTACK_CARDS, indices });
  }
  renderAll();
}
