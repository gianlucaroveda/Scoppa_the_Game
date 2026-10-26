// Entry point: collega i bottoni dell'HTML (data-action="nomeFunzione") alle funzioni.
// Per un nuovo bottone: scrivi data-action="miaFunzione" in index.html e aggiungila qui sotto.
import { state } from './state.js';
import { createRoom, joinRoom, startGame, leaveRoom, destroyRoom, updateNickname, copyRoomLink } from './lobby/room.js';
import { playerDrawCard } from './game/deck.js';
import { initCrt, toggleCrt } from './ui/crt.js';

const actions = {
  createRoom, joinRoom, startGame, leaveRoom, destroyRoom, updateNickname, copyRoomLink,
  playerDrawCard,
  toggleCrt,
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) actions[el.dataset.action]();
});

document.getElementById('nickname-input').value = state.nickname;

initCrt();
