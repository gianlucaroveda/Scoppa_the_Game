// poison: avvelena il bersaglio per `effect.turns` turni (default POISON_DURATION_TURNS).
// Con il veleno ogni danno e cura ricevuti valgono il doppio (scoring.js).
import { hostPoisonPlayer } from '../../scoring.js';
import { POISON_DURATION_TURNS } from '../../../settings.js';
import { isShielded } from './helpers.js';

export function poison({ targetId, destroyerId, effect }) {
  if (isShielded(targetId, destroyerId)) return; // Attacco Protetto: la carta viene solo distrutta
  hostPoisonPlayer(targetId, effect.turns ?? POISON_DURATION_TURNS);
}
