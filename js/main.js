// Entry point: collega i bottoni dell'HTML (data-action="nomeFunzione") alle funzioni.
// Per un nuovo bottone: scrivi data-action="miaFunzione" in index.html e aggiungila qui sotto.
import { state } from './state.js';
import { createRoom, joinRoom, startGame, leaveRoom, destroyRoom, updateNickname, copyRoomLink } from './lobby/room.js';
import { playerDrawCard } from './game/deck.js';
import { playerRematchReady } from './game/turns.js';
import { initCrt, toggleCrt } from './ui/crt.js';
import { playSound } from './ui/sound.js';
import { initSettingsMenu } from './ui/settingsMenu.js';

// Suono di ogni bottone (nomi in ui/sound.js)
const BUTTON_SOUNDS = {
  createRoom: 'createRoom',   // Crea stanza
  joinRoom: 'joinRoom',       // Entra
  leaveRoom: 'leaveButton',   // Esci
  destroyRoom: 'leaveButton', // Chiudi stanza
  rematch: 'createRoom',      // Rivincita
};

const actions = {
  createRoom, joinRoom, startGame, leaveRoom, destroyRoom, updateNickname, copyRoomLink,
  playerDrawCard,
  toggleCrt,
  rematch: playerRematchReady,
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || !actions[el.dataset.action]) return;
  const sound = BUTTON_SOUNDS[el.dataset.action];
  if (sound) playSound(sound);
  actions[el.dataset.action]();
});

document.getElementById('nickname-input').value = state.nickname;

initCrt();
initSettingsMenu();
