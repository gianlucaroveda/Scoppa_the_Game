// Schermate (lobby / scelta avatar / tavolo) e stato dei controlli in base a ruolo e connessione.
import { state } from '../state.js';
import { PHASES } from '../config.js';
import { renderPlayersGrid } from './render.js';

const VIEWS = { lobby: 'view-lobby', avatars: 'view-avatars', game: 'view-game' };
export function switchView(viewName) {
  Object.entries(VIEWS).forEach(([name, id]) => {
    document.getElementById(id).classList.toggle('hidden', name !== viewName);
  });
  document.getElementById('btn-leave-game').classList.toggle('hidden', viewName === 'lobby');
}

// La schermata dipende dalla fase della partita (state.game.phase): l'host la decide, tutti la seguono.
export function syncView() {
  const phase = state.game.phase;
  if (phase === PHASES.LOBBY) switchView('lobby');
  else if (phase === PHASES.AVATAR_SELECT) switchView('avatars');
  else switchView('game');
}

export function updateUIState(overrideRoomId = null) {
  const connected = !!state.peerId;
  const $ = id => document.getElementById(id);

  $('room-controls-disconnected').classList.toggle('hidden', connected);
  $('room-controls-connected').classList.toggle('hidden', !connected);
  $('btn-start-game').classList.toggle('hidden', !state.isHost);
  $('client-wait-msg').classList.toggle('hidden', state.isHost || !connected);
  $('btn-destroy-room').classList.toggle('hidden', !state.isHost);

  const badge = $('role-badge');
  if (!connected) {
    badge.innerText = 'Disconnesso';
    badge.className = 'badge';
  } else if (state.isHost) {
    badge.innerText = 'HOST';
    badge.className = 'badge badge--host';
  } else {
    badge.innerText = 'GIOCATORE';
    badge.className = 'badge badge--player';
  }

  $('display-room-id').innerText = overrideRoomId || state.peerId || '---';
  renderPlayersGrid();
}
