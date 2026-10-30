// Costanti e regole del gioco: qui si cambiano i numeri senza toccare la logica.

export const MIN_PLAYERS = 2;
export const HAND_SIZE = 5;            // carte in mano all'inizio della partita
export const STARTING_HP = 3;          // PV iniziali di ogni giocatore
export const POINTS_TO_WIN = 10;       // punti per vincere (se usate la vittoria a punti)
export const ATTACK_DESTROY_COUNT = 1; // carte distrutte da un attacco (modificabile da effetti 'attackMod', vedi effects.js)

// Fasi della partita
//  START   = inizio turno: il giocatore di turno pesca OPPURE attiva una carta
//  ATTACK  = il giocatore di turno sceglie un bersaglio
//  ATTACK_PICK = sceglie, a carte coperte, quale carta della mano del bersaglio distruggere
//  DEFENSE = il bersaglio può giocare una carta difensiva SOLO se è quella presa di mira (annulla l'attacco);
//            altrimenti pesca: la carta presa di mira viene distrutta (con il suo effetto) e ne pesca altrettante -> fine turno
export const PHASES = {
  LOBBY: 'lobby',
  AVATAR_SELECT: 'avatar_select',
  START: 'start',
  ATTACK: 'attack',
  ATTACK_PICK: 'attack_pick',
  DEFENSE: 'defense',
  GAME_OVER: 'game_over',
};

// Tempi animazioni (ms)
export const DRAW_FLIGHT_MS = 600;          // volo di una carta dal mazzo alla mano
export const DRAW_STAGGER_MS = 250;         // ritardo tra una carta e la successiva
export const REVEAL_MS = 300;               // comparsa della carta nella mano
export const CARD_OVERLAY_MS = 2500;        // overlay carta attivata/distrutta
export const CARD_OVERLAY_MULTI_MS = 3200;  // overlay con più carte distrutte
export const AUTO_RESOLVE_DELAY_MS = 1500;  // attacco su carte non difensive: si risolve da solo

// Avatar: immagini nella cartella avatar/ (il file di ogni avatar si imposta in game/avatars.js)
export const AVATAR_DIR = 'js/game/avatar/';
