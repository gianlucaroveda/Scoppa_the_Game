// heal: cura il bersaglio di `effect.amount` PV (raddoppiati se avvelenato, fino al massimo iniziale).
import { hostHealPlayer } from '../../scoring.js';

export function heal({ targetId, effect }) {
  hostHealPlayer(targetId, effect.amount);
}
