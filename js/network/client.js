// Lato CLIENT: riceve messaggi dall'host.
import { state } from '../state.js';
import { MSG } from './messages.js';
import { logNetwork, showToast } from '../ui/toast.js';
import { renderAll, renderMyHand } from '../ui/render.js';
import { cleanupPeer } from './peer.js';
import { showCardAnimation, showDrawAnimation } from '../ui/animations.js';
import { playSound } from '../ui/sound.js';

export function handleClientReceivedData(data) {
  logNetwork(`RX dall'Host: <b class="text-amber-300">${data.type}</b>`);

  switch (data.type) {
    case MSG.STATE_UPDATE: {
      const before = Object.keys(state.roomPlayers);
      state.roomPlayers = data.roomPlayers;
      state.playedTableCard = data.playedTableCard;
      state.game = data.game;
      state.deckCount = data.deckCount;
      // suoni: qualcuno è entrato / uscito dalla stanza (il primo aggiornamento, quando entri tu, non conta)
      if (before.length) {
        const after = Object.keys(data.roomPlayers);
        if (after.some(id => !before.includes(id))) playSound('playerJoined');
        else if (before.some(id => !after.includes(id))) playSound('playerLeft');
      }
      renderAll();
      break;
    }

    case MSG.MY_HAND: {
      const gained = data.hand.length - state.myHand.length;
      state.myHand = data.hand;
      if (!state.ui) state.ui = {};
      if (!Array.isArray(state.ui.hiddenUids)) state.ui.hiddenUids = [];
      if (data.drawn?.length) state.ui.hiddenUids.push(...data.drawn);
      if (gained > 0) showToast(`Hai pescato ${gained} carta/e`, 'success');
      renderMyHand();
      break;
    }
    case MSG.DRAW_ANIMATION:
      showDrawAnimation(data.payload);
      break;

    case MSG.EVENT:
      showToast(data.text, data.level || 'info');
      break;

    case MSG.NOTICE:
      showToast(data.text, data.level || 'error');
      break;

    case MSG.CARD_ANIMATION:
      showCardAnimation(data.payload);
      break;

    case MSG.ROOM_DESTROYED:
      showToast("L'Host ha eliminato la stanza.", 'error');
      cleanupPeer();
      break;
  }
}