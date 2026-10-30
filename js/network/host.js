// Lato HOST: riceve le azioni dei giocatori e le smista al modulo di gioco giusto.
// Per ogni nuova azione: aggiungi il tipo in messages.js e una riga in `handlers`.
import { state } from '../state.js';
import { PHASES, MIN_PLAYERS } from '../config.js';
import { MSG } from './messages.js';
import { sendToAll, notify } from './protocol.js';
import { logNetwork, showToast } from '../ui/toast.js';
import { renderAll } from '../ui/render.js';
import { createPlayer } from '../game/scoring.js';
import { playSound } from '../ui/sound.js';
import { hostHandleDraw, hostHandlePlayCard } from '../game/deck.js';
import { hostHandleSelectAvatar } from '../game/avatars.js';
import { hostHandleAttackTarget, hostHandleAttackCards, hostHandleRematchReady, hostOnPlayerLeft } from '../game/turns.js';
import { cleanupPeer } from './peer.js';

const handlers = {
  [MSG.JOIN_REQUEST]: (id, data) => {
    if (state.game.phase !== PHASES.LOBBY) {
      notify(id, 'La partita è già iniziata');
      setTimeout(() => state.clientConnections[id]?.close(), 300);
      return;
    }
    state.roomPlayers[id] = createPlayer(data.name || 'Giocatore', false);
    showToast(`${state.roomPlayers[id].name} è entrato!`, 'info');
    playSound('playerJoined');
    broadcastStateUpdate();
  },
  [MSG.UPDATE_NAME]: (id, data) => {
    if (state.roomPlayers[id]) {
      state.roomPlayers[id].name = data.name;
      broadcastStateUpdate();
    }
  },
  [MSG.DRAW_REQUEST]: hostHandleDraw,
  [MSG.PLAY_CARD]: hostHandlePlayCard,
  [MSG.SELECT_AVATAR]: hostHandleSelectAvatar,
  [MSG.ATTACK_TARGET]: hostHandleAttackTarget,
  [MSG.ATTACK_CARDS]: hostHandleAttackCards,
  [MSG.REMATCH_READY]: hostHandleRematchReady,
};

export function handleIncomingConnection(conn) {
  if (!state.isHost) return;

  conn.on('open', () => { state.clientConnections[conn.peer] = conn; });
  conn.on('data', (data) => handleHostReceivedData(conn.peer, data));
  conn.on('close', () => {
    delete state.clientConnections[conn.peer];
    if (!state.roomPlayers[conn.peer]) return; // non era un giocatore (rifiutato o stanza chiusa)
    delete state.roomPlayers[conn.peer];
    playSound('playerLeft');
    hostOnPlayerLeft(conn.peer);
    // A fine partita, se in stanza resta meno del minimo la stanza si chiude
    if (state.game.phase === PHASES.GAME_OVER && Object.keys(state.roomPlayers).length < MIN_PLAYERS) {
      sendToAll({ type: MSG.ROOM_DESTROYED });
      cleanupPeer();
      showToast('Troppi pochi giocatori: la stanza è stata chiusa', 'info');
      return;
    }
    broadcastStateUpdate();
  });
}

export function handleHostReceivedData(senderId, data) {
  logNetwork(`RX da [${senderId.substring(0, 6)}]: <b class="text-amber-300">${data.type}</b>`);
  const handler = handlers[data.type];
  if (handler) handler(senderId, data);
}

// Da chiamare dopo QUALSIASI modifica allo stato condiviso.
export function broadcastStateUpdate() {
  if (!state.isHost) return;
  renderAll();
  sendToAll({
    type: MSG.STATE_UPDATE,
    roomPlayers: state.roomPlayers,
    playedTableCard: state.playedTableCard,
    deckCount: state.masterDeck.length,
    game: state.game,
  });
}
