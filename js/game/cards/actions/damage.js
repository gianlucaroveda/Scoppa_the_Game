// damage: infligge `effect.amount` danni al bersaglio (raddoppiati se avvelenato, vedi scoring.js).
import { hostDamagePlayer } from '../../scoring.js';
import { isShielded } from './helpers.js';

export function damage({ targetId, destroyerId, effect }) {
  if (isShielded(targetId, destroyerId)) return; // Attacco Protetto: il distruttore non subisce il danno
  hostDamagePlayer(targetId, effect.amount);
}
