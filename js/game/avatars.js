// ===== SELEZIONE AVATAR =====
// Solo un'icona, nessun effetto. Ogni avatar può essere preso da un solo giocatore.
// Quando TUTTI hanno scelto, parte la partita (turns.js -> hostBeginMatch).
import { state } from '../state.js';
import { PHASES, AVATAR_DIR } from '../config.js';
import { MSG, sendAction, notify } from '../network/protocol.js';
import { broadcastStateUpdate } from '../network/host.js';
import { hostBeginMatch } from './turns.js';

// `file` = nome dell'immagine dentro la cartella avatar/ (vedi AVATAR_DIR in config.js).
// `icon` è l'emoji mostrata se l'immagine manca o non si carica.
export const AVATARS = [
  { id: 'wolf',    name: 'Lupo',     file: 'Pg1.png',    icon: '🐺' },
  { id: 'fox',     name: 'Volpe',    file: 'Pg2.png',     icon: '🦊' },
  { id: 'dragon',  name: 'Drago',    file: 'Pg3.png',  icon: '🐉' },
  { id: 'owl',     name: 'Gufo',     file: 'Pg4.png',     icon: '🦉' },
  { id: 'octopus', name: 'Polpo',    file: 'Pg5.png', icon: '🐙' },
  { id: 'unicorn', name: 'Unicorno', file: 'Pg6.png', icon: '🦄' },
  { id: 'bear',    name: 'Orso',     file: 'Pg7.png',    icon: '🐻' },
  { id: 'eagle',   name: 'Aquila',  file: 'Pg8.png',   icon: '🦅' },
];

export function getAvatar(id) {
  return AVATARS.find(a => a.id === id);
}

// HTML di un avatar: <img> da avatar/, con fallback emoji. size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export function avatarHTML(avatarId, size = 'md') {
  const a = getAvatar(avatarId);
  if (!a) return `<span class="avatar avatar--${size} avatar--empty">👤</span>`;
  return `<span class="avatar avatar--${size}"><img src="${AVATAR_DIR}${a.file}" alt="${a.name}" `
    + `onerror="this.replaceWith(document.createTextNode('${a.icon}'))"></span>`;
}

export function allAvatarsChosen() {
  const players = Object.values(state.roomPlayers);
  return players.length > 0 && players.every(p => p.avatarId);
}

// HOST
export function hostHandleSelectAvatar(senderId, data) {
  const player = state.roomPlayers[senderId];
  if (!player || state.game.phase !== PHASES.AVATAR_SELECT) return;
  if (!getAvatar(data.avatarId)) return;

  const owner = Object.entries(state.roomPlayers).find(([, p]) => p.avatarId === data.avatarId);
  if (owner && owner[0] !== senderId) return notify(senderId, 'Avatar già scelto da un altro giocatore');

  player.avatarId = data.avatarId; // si può cambiare finché non hanno scelto tutti
  if (allAvatarsChosen()) hostBeginMatch();
  broadcastStateUpdate();
}

// giocatore locale
export function playerSelectAvatar(avatarId) {
  sendAction({ type: MSG.SELECT_AVATAR, avatarId });
}
