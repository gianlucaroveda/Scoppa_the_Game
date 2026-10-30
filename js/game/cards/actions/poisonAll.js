// poisonAll: avvelena TUTTI i giocatori in vita per `effect.turns` turni (default POISON_DURATION_TURNS).
// Con il veleno ogni danno e cura ricevuti valgono il doppio (scoring.js).
// Se la carta viene DISTRUTTA da un attacco con Attacco Protetto attivo, viene solo distrutta: nessuno si avvelena.
import { state } from '../../../state.js';
import { hostPoisonPlayer } from '../../scoring.js';
import { POISON_DURATION_TURNS } from '../../../settings.js';
import { announce } from '../../../network/protocol.js';

export function poisonAll({ destroyerId, effect }) {
  if (destroyerId !== undefined && state.game?.attackMods?.ignoreTraps) return;
  Object.keys(state.roomPlayers).forEach(id => hostPoisonPlayer(id, effect.turns ?? POISON_DURATION_TURNS));
  announce('☠️ Tutti i giocatori sono stati avvelenati!');
}
