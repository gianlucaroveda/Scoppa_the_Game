// Suoni dell'interfaccia.
// Per ogni suono si cerca il file in audio/ (cartella SOUND_DIR in settings.js, nome nella tabella SOUNDS qui sotto).
// Se il file non c'è, viene riprodotto un bip 8-bit generato al volo (Web Audio), così il gioco ha comunque i suoni.
import { SOUND_DIR, SOUND_VOLUME } from '../settings.js';

/* ---------- volume master (salvato nel browser; SOUND_VOLUME è il valore di partenza) ---------- */
const VOL_KEY = 'volume';
let master = SOUND_VOLUME;
try {
  const saved = localStorage.getItem(VOL_KEY);
  if (saved !== null && !Number.isNaN(Number(saved))) master = Math.min(1, Math.max(0, Number(saved)));
} catch { /* storage non disponibile */ }

export const getVolume = () => master;
export function setVolume(v) {
  master = Math.min(1, Math.max(0, Number(v) || 0));
  try { localStorage.setItem(VOL_KEY, String(master)); } catch { /* ignora */ }
}

/* Tabella dei suoni: nome -> { file, synth }. synth = descrizione dei bip di riserva.
   tone: { f: frequenza Hz, f2: frequenza finale (glissando), t: ritardo s, d: durata s, type: onda, v: volume }
   noise: { t, d, v, f: frequenza del filtro } */
const SOUNDS = {
  createRoom:   { file: 'create-room.mp3',   synth: [tone(523, 0), tone(659, .08), tone(784, .16), tone(1047, .24, .16)] },  // bottone "Crea stanza"
  joinRoom:     { file: 'join-room.mp3',     synth: [tone(440, 0), tone(660, .09, .14)] },                                    // bottone "Entra"
  playerJoined: { file: 'player-joined.mp3', synth: [tone(988, 0, .08), tone(1319, .08, .2)] },                              // qualcuno entra nella lobby
  playerLeft:   { file: 'player-left.mp3',   synth: [tone(659, 0, .09), tone(392, .09, .2)] },                               // qualcuno esce dalla stanza
  leaveButton:  { file: 'leave-room.mp3',    synth: [{ f: 700, f2: 180, t: 0, d: .28, type: 'sawtooth', v: .22 }] },          // bottoni "Esci" / "Chiudi stanza"
  heal:         { file: 'cura.wav',         synth: [{ f: 523, t: 0, d: .12, type: 'triangle', v: .3 }, { f: 784, t: .09, d: .12, type: 'triangle', v: .3 }, { f: 1047, t: .18, d: .22, type: 'triangle', v: .3 }] }, // cura
  damage:       { file: 'damage.mp3',       synth: [{ noise: true, t: 0, d: .16, v: .5, f: 900 }, { f: 220, f2: 70, t: 0, d: .2, type: 'sawtooth', v: .35 }] },                                // danno inflitto
  destroyCard:  { file: 'destroy-card.mp3', synth: [{ noise: true, t: 0, d: .28, v: .55, f: 1800 }, { f: 300, f2: 60, t: 0, d: .3, type: 'square', v: .25 }] },                                 // carta distrutta
  draw:         { file: 'draw-card.mp3',     synth: [{ noise: true, t: 0, d: .09, v: .35, f: 3200 }, { f: 1300, f2: 650, t: 0, d: .06, v: .1 }] }, // carta pescata
  playCard:     { file: 'play-card.mp3',     synth: [{ f: 190, f2: 80, t: 0, d: .14, type: 'triangle', v: .45 }, tone(880, .06, .15), tone(1319, .12, .18)] }, // carta giocata
};

function tone(f, t = 0, d = .1) { return { f, t, d }; }

/* ---------- riproduzione ---------- */

let ctx = null;
const missing = new Set(); // suoni il cui file non esiste: si usa direttamente il bip

function audioCtx() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function synth(def) {
  const c = audioCtx();
  if (!c) return;
  def.synth.forEach(p => (p.noise ? noiseBurst(c, p) : beep(c, p)));
}

function beep(c, { f, f2, t = 0, d = .1, type = 'square', v = .25 }) {
  const t0 = c.currentTime + t;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v * master), t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + d + 0.03);
}

function noiseBurst(c, { t = 0, d = .1, v = .3, f = 2000 }) {
  const t0 = c.currentTime + t;
  const len = Math.max(1, Math.floor(c.sampleRate * d));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len); // rumore che si spegne
  const src = c.createBufferSource(); src.buffer = buf;
  const filter = c.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = f;
  const g = c.createGain(); g.gain.value = Math.max(0.0002, v * master);
  src.connect(filter).connect(g).connect(c.destination);
  src.start(t0);
}

export function playSound(name) {
  const def = SOUNDS[name];
  if (!def || master <= 0) return; // muto
  try {
    if (!missing.has(name)) {
      const a = new Audio(SOUND_DIR + def.file);
      a.volume = master;
      const p = a.play();
      if (p && p.catch) {
        p.catch(err => {
          if (err?.name === 'NotAllowedError') return;       // il browser blocca l'audio finché non clicchi sulla pagina
          missing.add(name);                                   // file mancante o illeggibile: da ora in poi bip
          synth(def);
        });
      }
      return;
    }
    synth(def);
  } catch {
    missing.add(name);
    try { synth(def); } catch { /* nessun audio disponibile */ }
  }
}
