// Impostazioni aggiunte con le nuove carte. Puoi spostarle in config.js se preferisci (basta aggiornare gli import).
export const CARD_IMAGE_DIR = 'js/game/cards/Immagini/'; // cartella delle immagini delle carte (percorso dall'index.html)
export const POISON_DURATION_TURNS = 3;                   // durata dell'avvelenamento, in turni (giocati da chiunque)
export const PHASE_BANNER_MS = 3000;                      // durata totale della scritta di fase (≈2,7 s visibile + dissolvenza)

// Suoni: file in SOUND_DIR (nomi in ui/sound.js). Se un file manca viene usato un "bip" 8-bit generato dal browser.
export const SOUND_DIR = 'js/audio/';
export const SOUND_VOLUME = 0.6; // 0 = muto, 1 = massimo
