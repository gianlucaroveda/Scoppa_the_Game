import { state } from '../state.js';
import { MSG } from './messages.js';
import { handleHostReceivedData } from './host.js';
import { showToast } from '../ui/toast.js';
import { showCardAnimation, showDrawAnimation } from '../ui/animations.js';

export { MSG };

export function sendToHost(msg) {
  const c = state.hostConnection;
  if (c && c.open) c.send(msg);
}

export function sendToPlayer(peerId, msg) {
  const c = state.clientConnections[peerId];
  if (c && c.open) c.send(msg);
}

export function sendToAll(msg) {
  Object.values(state.clientConnections).forEach(c => { if (c.open) c.send(msg); });
}

export function sendAction(msg) {
  if (!state.peerId) return;
  if (state.isHost) handleHostReceivedData(state.peerId, msg);
  else sendToHost(msg);
}

export function announce(text, level = 'info') {
  showToast(text, level);
  sendToAll({ type: MSG.EVENT, text, level });
}

export function notify(playerId, text, level = 'error') {
  if (playerId === state.peerId) showToast(text, level);
  else sendToPlayer(playerId, { type: MSG.NOTICE, text, level });
}

export function broadcastCardAnimation(payload) {
  showCardAnimation(payload);
  sendToAll({ type: MSG.CARD_ANIMATION, payload });
}

export function broadcastDrawAnimation(payload) {
  showDrawAnimation(payload);
  sendToAll({ type: MSG.DRAW_ANIMATION, payload });
}