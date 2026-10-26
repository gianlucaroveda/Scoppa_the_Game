// counterAttack (onDestroy): il proprietario della carta potrà attaccare chi l'ha distrutta.
// Qui si segna soltanto; il contrattacco parte da turns.js (hostResolveUndefendedAttack -> hostStartCounterAttack).
import { state } from '../../../state.js';

export function counterAttack({ ownerId, destroyerId }) {
  if (!ownerId || !destroyerId || ownerId === destroyerId) return;
  state.game.counterAttack = { playerId: ownerId, targetId: destroyerId };
}
