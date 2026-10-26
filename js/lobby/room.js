// Creazione/ingresso/chiusura stanza, avvio partita, nickname.
import { state } from '../state.js';
import { MSG, sendToAll, sendToHost } from '../network/protocol.js';
import { initPeer, cleanupPeer } from '../network/peer.js';
import { broadcastStateUpdate } from '../network/host.js';
import { handleClientReceivedData } from '../network/client.js';
import { logNetwork, showToast } from '../ui/toast.js';
import { updateUIState } from '../ui/views.js';
import { MIN_PLAYERS } from '../config.js';
import { createPlayer } from '../game/scoring.js';
import { generateMasterDeck } from '../game/deck.js';
import { hostStartAvatarSelection } from '../game/turns.js';

export async function createRoom() {
  try {
    const roomId = 'room-' + Math.random().toString(36).substring(2, 8);
    await initPeer(roomId);

    state.isHost = true;
    state.roomPlayers = { [state.peerId]: createPlayer(state.nickname, true) };

    generateMasterDeck();
    updateUIState();
    showToast("Stanza Creata! Condividi l'ID con gli amici.", 'success');
  } catch (err) {
    console.error('Errore creazione stanza:', err);
  }
}

export async function joinRoom() {
  const targetRoomId = document.getElementById('join-room-id').value.trim();
  if (!targetRoomId) {
    showToast('Inserisci un ID Stanza valido', 'error');
    return;
  }

  try {
    await initPeer();
    state.isHost = false;

    logNetwork(`Connessione all'Host: ${targetRoomId}...`);
    const conn = state.peer.connect(targetRoomId);
    state.hostConnection = conn;

    conn.on('open', () => {
      logNetwork(`<span class="text-emerald-400">Connesso con successo all'Host!</span>`);
      updateUIState(targetRoomId);
      conn.send({ type: MSG.JOIN_REQUEST, name: state.nickname });
    });
    conn.on('data', handleClientReceivedData);
    conn.on('close', () => {
      if (!state.hostConnection) return; // già in chiusura volontaria
      showToast("Connessione con l'Host interrotta", 'error');
      cleanupPeer();
    });
  } catch (err) {
    console.error('Errore join stanza:', err);
  }
}

// Il bottone porta tutti alla scelta avatar; la partita parte quando hanno scelto tutti (game/avatars.js).
export function startGame() {
  if (!state.isHost) return;
  if (Object.keys(state.roomPlayers).length < MIN_PLAYERS) {
    showToast(`Servono almeno ${MIN_PLAYERS} giocatori`, 'error');
    return;
  }
  hostStartAvatarSelection();
  broadcastStateUpdate();
  showToast('Scegliete il vostro avatar!', 'success');
}

export function leaveRoom() {
  cleanupPeer();
  showToast('Ti sei scollegato dalla partita', 'info');
}

export function destroyRoom() {
  if (!state.isHost) return;
  sendToAll({ type: MSG.ROOM_DESTROYED });
  cleanupPeer();
  showToast('Stanza eliminata', 'info');
}

export function updateNickname() {
  const val = document.getElementById('nickname-input').value.trim();
  if (!val) return;

  state.nickname = val;
  showToast(`Nome salvato: ${state.nickname}`, 'success');

  if (state.peerId && state.roomPlayers[state.peerId]) {
    state.roomPlayers[state.peerId].name = state.nickname;
    if (state.isHost) broadcastStateUpdate();
    else sendToHost({ type: MSG.UPDATE_NAME, name: state.nickname });
  }
}

export function copyRoomLink() {
  const roomId = document.getElementById('display-room-id').textContent.trim(); // textContent: ignora text-transform del CSS (gli ID PeerJS sono case-sensitive)
  if (!roomId || roomId === '---') return;
  navigator.clipboard.writeText(roomId).then(() => showToast('ID Stanza copiato negli appunti!', 'success'));
}
