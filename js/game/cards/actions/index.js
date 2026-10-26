// Registro degli effetti: l'"action" scritta in cardDefs.js corrisponde alla chiave qui sotto.
// Le funzioni ricevono { ownerId, targetId, destroyerId, effect }, dove targetId è GIÀ il giocatore colpito
// (calcolato da effect.target). Girano solo sull'HOST.
//
// NUOVO EFFETTO: 1) crea un file in questa cartella che esporta la funzione, 2) importalo e aggiungilo qui sotto.
import { damage } from './damage.js';
import { heal } from './heal.js';
import { attackMod } from './attackMod.js';
import { shieldSelf } from './shieldSelf.js';
import { resetAndDeal } from './resetAndDeal.js';
import { counterAttack } from './counterAttack.js';
import { poison } from './poison.js';

export const EFFECT_ACTIONS = {
  damage,
  heal,
  attackMod,
  shieldSelf,
  resetAndDeal,
  counterAttack,
  poison,
};
