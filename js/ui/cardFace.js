import { getCardDef } from '../game/cards/cardDefs.js';
import { escapeHtml } from '../utils.js';
import { CARD_IMAGE_DIR } from '../settings.js';

const TYPE_META = {
  attack:  { icon: '⚔️', label: 'Attacco' },
  defense: { icon: '🛡️', label: 'Difesa' },
  spell:   { icon: '✨', label: 'Magia' },
  trap:    { icon: '💣', label: 'Trappola' },
};

// Immagine della carta: def.image se c'è, altrimenti <id>.png. Un nome semplice viene cercato in CARD_IMAGE_DIR.
// Se il file manca compare l'icona del tipo di carta.
function imageSrc(def) {
  const file = def.image ?? `${def.id}.png`;
  return file.includes('/') ? file : CARD_IMAGE_DIR + file;
}

// Accetta sia una carta { uid, defId } sia una definizione. Gli stili sono in css/cards.css.
export function cardFaceHTML(cardOrDef) {
  const def = cardOrDef?.defId ? getCardDef(cardOrDef.defId) : cardOrDef;
  if (!def) return '<div class="card__type">Carta sconosciuta</div>';
  const meta = TYPE_META[def.type] || { icon: '🃏', label: def.type };
  const art = `<img src="${escapeHtml(imageSrc(def))}" alt="" class="card__img" onerror="this.outerHTML='<span>${meta.icon}</span>'">`;
  return `
    <div class="card__head"><span class="card__name">${escapeHtml(def.name)}</span><span class="card__cost">${def.cost}</span></div>
    <div class="card__art card__art--${def.type}">${art}</div>
    <div class="card__type card__type--${def.type}">${meta.label}</div>`; // l'effetto si legge selezionando la carta (cardReadHTML)
}

// Vista "lettura" della carta selezionata: al posto dell'immagine mostra l'effetto. Si torna alla copertina deselezionando.
export function cardReadHTML(cardOrDef, playable = true, defending = false) {
  const def = cardOrDef?.defId ? getCardDef(cardOrDef.defId) : cardOrDef;
  if (!def) return cardFaceHTML(cardOrDef);
  const meta = TYPE_META[def.type] || { icon: '🃏', label: def.type };
  return `
    <div class="card__head"><span class="card__name">${escapeHtml(def.name)}</span><span class="card__cost">${def.cost}</span></div>
    <div class="card__type card__type--${def.type}">${meta.label}${def.passive ? ' · passiva' : ''}</div>
    <div class="card__text">${escapeHtml(def.text)}</div>
    <div class="card__hint">${defending ? 'Clicca di nuovo per attivarla · clic fuori per non usarla' : playable ? 'Clicca di nuovo per giocarla' : 'Non giocabile adesso'}</div>`;
}
