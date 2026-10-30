// Tipi di messaggio scambiati fra host e client (file senza dipendenze, per evitare import circolari).
export const MSG = {
  // client -> host
  JOIN_REQUEST: 'JOIN_REQUEST',
  UPDATE_NAME: 'UPDATE_NAME',
  DRAW_REQUEST: 'DRAW_REQUEST',     // pesca (inizio turno) o pesca difensiva: dipende dalla fase
  PLAY_CARD: 'PLAY_CARD',           // { uid, targetId? }
  SELECT_AVATAR: 'SELECT_AVATAR',   // { avatarId }
  ATTACK_TARGET: 'ATTACK_TARGET',   // { targetId }
  ATTACK_CARDS: 'ATTACK_CARDS',     // { indices } posizioni (a carte coperte) nella mano del bersaglio
  REMATCH_READY: 'REMATCH_READY',   // (nessun dato) a fine partita: segna / annulla "pronto per la rivincita"
  // host -> client
  STATE_UPDATE: 'STATE_UPDATE',
  MY_HAND: 'MY_HAND',               // { hand } la tua mano aggiornata
  NOTICE: 'NOTICE',                 // { text, level } messaggio per un solo giocatore
  EVENT: 'EVENT',                   // { text, level } annuncio per tutti (carta giocata, distrutta...)
  ROOM_DESTROYED: 'ROOM_DESTROYED',
  DRAW_ANIMATION: 'DRAW_ANIMATION',
  CARD_ANIMATION: 'CARD_ANIMATION', // { defId, message } animazione di una carta (giocata o distrutta)
};
