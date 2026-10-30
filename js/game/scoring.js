// ===== PV, PUNTI E VITTORIA =====
// Queste funzioni modificano solo lo stato dell'host: chi le chiama poi fa broadcastStateUpdate().
import { state } from '../state.js';
import { STARTING_HP, POINTS_TO_WIN, PHASES } from '../config.js';

export function createPlayer(name, isHost) {
  return { name, isHost, handCount: 0, avatarId: null, hp: STARTING_HP, points: 0, eliminated: false, poison: 0, poisonTurn: 0, rematchReady: false };
}

// Rivincita: tutti tornano ai valori iniziali (nome, ruolo e avatar restano).
export function hostResetPlayers() {
  Object.values(state.roomPlayers).forEach(p => {
    p.hp = STARTING_HP; p.points = 0; p.eliminated = false; p.poison = 0; p.poisonTurn = 0; p.rematchReady = false;
  });
}

/* ---------- stato avvelenamento ---------- */
// poison = turni rimanenti (0 = non avvelenato). Con il veleno ogni danno/cura RICEVUTO vale il doppio.
// Il contatore è personale di ogni giocatore e scende a ogni turno che finisce (di chiunque).
export const isPoisoned = id => (state.roomPlayers[id]?.poison ?? 0) > 0;
export const modifyByStatus = (playerId, amount) => (isPoisoned(playerId) ? amount * 2 : amount);

export function hostPoisonPlayer(playerId, turns) {
  const p = state.roomPlayers[playerId];
  if (!p || p.eliminated) return;
  p.poison = Math.max(p.poison || 0, turns);
  p.poisonTurn = state.game.turnNumber; // il turno in cui l'hai preso non conta
}

// Chiamata a ogni fine turno. Ritorna gli id dei giocatori guariti.
export function hostTickPoison(turnNumber) {
  const cured = [];
  Object.entries(state.roomPlayers).forEach(([id, p]) => {
    if (!(p.poison > 0) || p.poisonTurn === turnNumber) return;
    p.poison--;
    if (p.poison === 0) cured.push(id);
  });
  return cured;
}

export function hostDamagePlayer(playerId, amount) {
  const p = state.roomPlayers[playerId];
  if (!p) return;
  p.hp = Math.max(0, p.hp - modifyByStatus(playerId, amount));
  if (p.hp === 0) p.eliminated = true;
}

export function hostHealPlayer(playerId, amount) {
  const p = state.roomPlayers[playerId];
  if (!p || p.eliminated) return;
  p.hp = Math.min(STARTING_HP, p.hp + modifyByStatus(playerId, amount)); // TODO: PV massimi per avatar?
}

export function hostAddPoints(playerId, amount) {
  const p = state.roomPlayers[playerId];
  if (p) p.points += amount;
}

// Condizioni di vittoria: ultimo in vita, oppure punti raggiunti. Se muoiono tutti insieme è pareggio (winnerId null).
// Ritorna true se la partita è finita. TODO: eventuali altre regole.
export function hostCheckVictory() {
  const players = Object.entries(state.roomPlayers);
  const alive = players.filter(([, p]) => !p.eliminated);
  let winnerId = null;

  const draw = players.length > 1 && alive.length === 0;
  if (players.length > 1 && alive.length === 1) winnerId = alive[0][0];
  const byPoints = players.find(([, p]) => p.points >= POINTS_TO_WIN);
  if (byPoints) winnerId = byPoints[0];

  if (winnerId || draw) {
    state.game.winnerId = winnerId;
    state.game.phase = PHASES.GAME_OVER;
  }
  return state.game.phase === PHASES.GAME_OVER;
}
