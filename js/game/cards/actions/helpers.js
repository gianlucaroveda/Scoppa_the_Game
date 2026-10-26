// Funzioni condivise dagli effetti.
import { state } from '../../../state.js';

// "Attacco Protetto" attivo (attackMods.ignoreTraps) e il bersaglio dell'effetto è proprio chi ha distrutto la carta:
// in quel caso non subisce né danni né veleno dalle carte distrutte.
export function isShielded(targetId, destroyerId) {
  return targetId !== undefined && targetId === destroyerId && !!state.game?.attackMods?.ignoreTraps;
}
