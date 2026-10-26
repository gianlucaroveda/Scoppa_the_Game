// Garantisce che css/effects.css sia caricato, anche se l'index.html non ha il <link>.
// Viene aggiunto in coda all'<head>, così le sue regole hanno la precedenza sugli altri CSS.
export function ensureEffectsCss() {
  const already = [...document.querySelectorAll('link[rel="stylesheet"]')].some(l => (l.getAttribute('href') || '').endsWith('effects.css'));
  if (already) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/effects.css';
  document.head.appendChild(link);
}
