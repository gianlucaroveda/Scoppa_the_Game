// Notifiche a schermo e log di rete. Stili: css/ui.css (.toast, .log)

export function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast${type === 'error' ? ' toast--error' : type === 'success' ? ' toast--success' : ''}`;
  toast.innerHTML = '<span class="toast__icon">▶</span><span class="toast__msg"></span>';
  toast.querySelector('.toast__msg').textContent = msg;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

export function logNetwork(msg) {
  const logBox = document.getElementById('network-log');
  if (!logBox) return;
  const entry = document.createElement('div');
  const time = new Date().toLocaleTimeString().split(' ')[0];
  entry.innerHTML = `<span class="log__time">[${time}]</span> ${msg}`;
  logBox.appendChild(entry);
  logBox.scrollTop = logBox.scrollHeight;
}
