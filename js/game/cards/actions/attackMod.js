// attackMod: modifica l'attacco del turno corrente (si azzera a fine turno).
//   destroyCount: quante carte distrugge l'attacco    ignoreTraps: protezione (vedi shieldSelf)
import { state } from '../../../state.js';

export function attackMod({ effect }) {
  if (!state.game.attackMods) state.game.attackMods = {};
  if (effect.destroyCount !== undefined) state.game.attackMods.destroyCount = effect.destroyCount;
  if (effect.ignoreTraps !== undefined) state.game.attackMods.ignoreTraps = effect.ignoreTraps;
}
