// Stato condiviso dell'app. Un solo oggetto esportato: tutti i moduli leggono/scrivono `state.xxx`.
import { PHASES, ATTACK_DESTROY_COUNT } from './config.js';

export const state = {};

export function resetState() {
  Object.assign(state, {
    // rete
    peer: null,
    peerId: null,
    isHost: false,
    hostConnection: null,     // valorizzata se sei CLIENT
    clientConnections: {},    // valorizzata se sei HOST { peerId: DataConnection }

    // stato di stanza (l'host è la fonte di verità, i client ricevono copie via STATE_UPDATE)
    // roomPlayers[id] = { name, isHost, handCount, avatarId, hp, points, eliminated }
    roomPlayers: {},
    playedTableCard: null,    // ultima carta giocata { uid, defId }
    deckCount: 0,             // (client) carte rimaste nel mazzo
    game: {
      phase: PHASES.LOBBY,
      turnOrder: [],          // id dei giocatori nell'ordine di gioco
      currentPlayerId: null,
      turnNumber: 0,
      winnerId: null,
      pendingAttack: null,    // { attackerId, targetId, destroyCount, cardUids } cardUids = carte prese di mira (note a host e bersaglio)
      attackMods: { destroyCount: ATTACK_DESTROY_COUNT }, // modifiche all'attacco del turno (si azzerano a ogni turno)
    },

    // privato
    myHand: [],               // [{ uid, defId }] solo tu la vedi (copia inviata dall'host)
    hands: {},                // SOLO HOST: { playerId: [carte] } fonte di verità delle mani
    masterDeck: [],           // SOLO HOST: mai inviato ai client
    ui: { cardPick: null, selectedCard: null, destroyPicks: [], hiddenUids: [], revealing: {} },
// selectedCard: carta alzata col primo clic; hiddenUids: carte appena pescate, nascoste finché non arriva l'animazione
  });
}

state.nickname = 'Giocatore_' + Math.floor(Math.random() * 899 + 100);
resetState();
