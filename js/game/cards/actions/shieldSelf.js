// shieldSelf: "Attacco Protetto". Per il resto del turno chi attacca:
//  - non subisce i danni delle trappole che distrugge (damage.js)
//  - non prende il veleno dalle carte che distrugge (poison.js)
//  - non viene contagiato, e non contagia il bersaglio, quando attacca (infectOnAttack in turns.js)
import { state } from '../../../state.js';

export function shieldSelf() {
  if (!state.game.attackMods) state.game.attackMods = {};
  state.game.attackMods.ignoreTraps = true;
}
