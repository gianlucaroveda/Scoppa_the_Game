// ===== DEFINIZIONE CARTE CUSTOM =====
// Ogni carta è un oggetto dati; gli effetti sono descritti qui e implementati in effects.js.
// TODO (voi): tutte le carte vere. Questa è solo un esempio del formato.
// ===== DEFINIZIONE CARTE CUSTOM =====
export const CARD_DEFS = {
  attack_boost: {
    id: 'attack_boost',
    name: 'Sex Toys',
    type: 'spell',
    text: 'Il tuo attacco in questo turno distrugge 2 carte.',
    effects: [{ trigger: 'onPlay', action: 'attackMod', destroyCount: 2 }],
  },

  spiked_trap: {
    id: 'spiked_trap',
    name: 'Culo cacato',
    type: 'trap',
    passive: true,
    text: "Se viene distrutta, infligge 1 danno a chi l'ha distrutta.",
    effects: [{ trigger: 'onDestroy', action: 'damage', amount: 1, target: 'destroyer' }],
  },

  cursed_idol: {
    id: 'cursed_idol',
    name: 'Fica',
    type: 'trap',
    passive: true,
    text: 'Se viene distrutta, il suo proprietario perde 1 PV.',
    effects: [{ trigger: 'onDestroy', action: 'damage', amount: 1, target: 'owner' }],
  },
  cursed_idol1: {
    id: 'cursed_idol1',
    name: 'Fica',
    type: 'trap',
    passive: true,
    text: 'Se viene distrutta, il suo proprietario perde 1 PV.',
    effects: [{ trigger: 'onDestroy', action: 'damage', amount: 1, target: 'owner' }],
  },

  dummy: {
    id: 'dummy',
    name: 'Fazzoletti',
    type: 'trap',
    passive: true,
    text: 'Questa carta non fa nulla.',
    effects: [],
  },
  dummy1: {
    id: 'dummy1',
    name: 'Fazzoletto',
    type: 'trap',
    passive: true,
    text: 'Questa carta non fa nulla.',
    effects: [],
  },

  safe_attack: {
    id: 'safe_attack',
    name: 'Preservativo',
    type: 'attack',
    text: 'Per questo turno: le carte che distruggi non ti danneggiano né ti avvelenano, e il veleno non passa né a te né a chi attacchi.',
    effects: [
      { trigger: 'onPlay', action: 'shieldSelf' }
    ],
  },

    safe_attack1: {
    id: 'safe_attack1',
    name: 'Preservativo',
    type: 'attack',
    text: 'Per questo turno: le carte che distruggi non ti danneggiano né ti avvelenano, e il veleno non passa né a te né a chi attacchi.',
    effects: [
      { trigger: 'onPlay', action: 'shieldSelf' }
    ],
  },

  minor_heal: {
    id: 'minor_heal',
    name: 'Viagara',
    type: 'spell',
    text: 'Recupera 1 PV.',
    effects: [{ trigger: 'onPlay', action: 'heal', amount: 1, target: 'self' }]
  },

  vampiric_curse: {
    id: 'vampiric_curse',
    name: 'Fica dorata',
    type: 'trap',
    passive: true,
    text: "Se viene distrutta, il proprietario perde 2 PV e chi l'ha distrutta recupera 1 PV.",
    effects: [
      { trigger: 'onDestroy', action: 'damage', amount: 2, target: 'owner' },
      { trigger: 'onDestroy', action: 'heal', amount: 1, target: 'destroyer' }
    ]
  },

  // ---------- carte aggiunte ----------
  // IMMAGINI: di default una carta usa Immagini/<id>.png (cartella CARD_IMAGE_DIR in settings.js).
  // Per un nome diverso aggiungi  image: 'nomefile.png'  alla carta.

  // Difesa: si gioca solo quando vieni attaccato e solo se è la carta presa di mira. Annulla l'attacco.
  parry: {
    id: 'parry',
    name: 'Impotenza',
    type: 'defense',
    text: "Giocala per annullare l'attacco.",
    effects: [],
  },

  // Come hostResetDeck + hostDealCards: mazzo rimescolato, mani azzerate, 5 carte a testa (per TUTTI).
  reshuffle: {
    id: 'reshuffle',
    name: 'Bukkake',
    type: 'spell',
    text: 'Rimescola il mazzo: tutti i giocatori scartano la mano e pescano 5 carte.',
    effects: [{ trigger: 'onPlay', action: 'resetAndDeal' }],
    
  },

  // Se viene distrutta, il proprietario attacca subito chi lo ha attaccato (prima che finisca il turno dell'attaccante).
  counter_mirror: {
    id: 'counter_mirror',
    name: 'Trenino',
    type: 'trap',
    passive: true,
    text: 'Se viene distrutta, contrattacchi subito chi ti ha attaccato.',
    effects: [{ trigger: 'onDestroy', action: 'counterAttack' }],
  },

  // Avvelenamento: danni e cure ricevuti x2 per 3 turni (contati a ogni turno che passa, di chiunque).
  // Chi è avvelenato e attacca contagia il bersaglio (se non è già avvelenato).
  venom: {
    id: 'venom',
    name: 'AIDS',
    type: 'spell',
    text: 'AIDS per 3 turni: danni e cure ricevuti valgono il doppio. Chi attacchi viene contagiato.',
    effects: [{ trigger: 'onPlay', action: 'poison', target: 'self' }],
  },
};

export const DECK_LIST = {
  attack_boost: 7,
  spiked_trap: 6,
  cursed_idol: 6,
  cursed_idol1: 6,
  dummy: 5,
  dummy1: 5,
  safe_attack: 5,
  safe_attack1: 5,
  minor_heal: 5,
  vampiric_curse: 3,
  parry: 5,
  reshuffle: 2,
  counter_mirror: 5,
  venom: 2,
};

export function getCardDef(defId) { return CARD_DEFS[defId]; }
export function cardNeedsTarget(def) { return !!def?.effects?.some(e => e.target === 'opponent'); }
// Target possibili negli effetti: 'self' | 'opponent' (scelto dal giocatore) | 'destroyer' | 'owner' (solo onDestroy)
// Trigger: 'onPlay' (quando la giochi) | 'onDestroy' (quando viene distrutta da un attacco)
// Una carta con un effetto su 'opponent' richiede che il giocatore scelga un bersaglio.

