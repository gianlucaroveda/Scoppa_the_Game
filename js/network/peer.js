// Ciclo di vita della connessione PeerJS (Peer è globale dal CDN).
import { state, resetState } from '../state.js';
import { logNetwork, showToast } from '../ui/toast.js';
import { switchView, updateUIState } from '../ui/views.js';
import { handleIncomingConnection } from './host.js';

export function initPeer(customId = null) {
  return new Promise((resolve, reject) => {
    cleanupPeer();
    state.peer = customId ? new Peer(customId) : new Peer();

    state.peer.on('open', (id) => {
      state.peerId = id;
      logNetwork(`PeerJS Inizializzato. Tuo ID: <b class="text-amber-400">${id}</b>`);
      resolve(id);
    });
    state.peer.on('connection', handleIncomingConnection);
    state.peer.on('error', (err) => {
      logNetwork(`<span class="text-rose-400">Errore PeerJS: ${err.type}</span>`);
      showToast(`Errore Rete: ${err.type}`, 'error');
      reject(err);
    });
  });
}

export function cleanupPeer() {
  // Prima azzero lo stato, poi chiudo: così i callback 'close' non rientrano in cleanup.
  const conns = Object.values(state.clientConnections);
  const hostConn = state.hostConnection;
  const peer = state.peer;
  resetState();

  conns.forEach(c => c.close());
  if (hostConn) hostConn.close();
  if (peer) peer.destroy();

  switchView('lobby');
  updateUIState();
}
