// resetAndDeal: stesso funzionamento di hostResetDeck + hostDealCards (deck.js):
// nuovo mazzo, mani azzerate, HAND_SIZE carte a testa per TUTTI. La carta appena giocata resta sul tavolo.
import { HAND_SIZE } from '../../../config.js';
import { announce } from '../../../network/protocol.js';
import { generateMasterDeck, hostClearHands, hostDealHands } from '../../deck.js';

export function resetAndDeal() {
  generateMasterDeck();
  hostClearHands();
  hostDealHands(HAND_SIZE, true); // true = con animazione di pesca
  announce(`🔀 Mazzo rimescolato: ${HAND_SIZE} carte a testa`);
}
