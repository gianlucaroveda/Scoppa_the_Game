// ===== RISOLUZIONE DEGLI EFFETTI DELLE CARTE =====
// Ogni "action" usata in cardDefs.js è implementata in un file a parte dentro actions/ (registro: actions/index.js).
// Qui c'è solo il codice che, data una carta e un trigger, esegue i suoi effetti. Gira solo sull'HOST.
import { state } from '../../state.js';
import { hostCheckVictory } from '../scoring.js';
import { EFFECT_ACTIONS } from './actions/index.js';

export { EFFECT_ACTIONS };

export const NO_DESTROY_EFFECT_TYPES = ['attack', 'defense'];

function resolveTargetId(effect, { ownerId, targetId, destroyerId }) {
  switch (effect.target) {
    case 'self':
    case 'owner':     return ownerId;
    case 'opponent':  return targetId;
    case 'destroyer': return destroyerId;
    default:          return undefined;
  }
}

export function resolveCardEffect(card, { ownerId, targetId, destroyerId, trigger = 'onPlay' }) {
  if (!state.isHost || !card?.effects) return;
  if (trigger === 'onDestroy' && NO_DESTROY_EFFECT_TYPES.includes(card.type)) return;

  card.effects.filter(e => e.trigger === trigger).forEach(effect => {
    const action = EFFECT_ACTIONS[effect.action];
    if (action) action({ ownerId, destroyerId, targetId: resolveTargetId(effect, { ownerId, targetId, destroyerId }), effect });
  });
  hostCheckVictory();
}
