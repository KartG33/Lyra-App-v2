export function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;

  container.appendChild(el);

  // Trigger animation
  requestAnimationFrame(() => {
    el.classList.add('show');
  });

  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300); // Wait for transition
  }, 3000);
}

export function confirmModal(title, text) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirm-modal-overlay');
    const titleEl = document.getElementById('confirm-modal-title');
    const textEl = document.getElementById('confirm-modal-text');
    const btnCancel = document.getElementById('confirm-modal-cancel');
    const btnOk = document.getElementById('confirm-modal-ok');

    if (!overlay) {
      // Fallback if UI is not available
      resolve(confirm(`${title}\n\n${text}`));
      return;
    }

    titleEl.textContent = title;
    textEl.textContent = text;
    overlay.classList.add('show');

    const close = (result) => {
      overlay.classList.remove('show');
      btnCancel.removeEventListener('click', onCancel);
      btnOk.removeEventListener('click', onOk);
      resolve(result);
    };

    const onCancel = () => close(false);
    const onOk = () => close(true);

    btnCancel.addEventListener('click', onCancel);
    btnOk.addEventListener('click', onOk);
  });
}

// Global Context Menu Manager
let _currentContextMenu = null;

export function showContextMenu(e, items) {
  e.preventDefault();
  const menu = document.getElementById('context-menu');
  if (!menu) return;

  menu.innerHTML = '';

  items.forEach(item => {
    if (item === 'separator') {
      const sep = document.createElement('div');
      sep.className = 'context-menu-separator';
      menu.appendChild(sep);
      return;
    }

    const el = document.createElement('div');
    el.className = `context-menu-item ${item.danger ? 'danger' : ''}`;
    el.textContent = item.label;
    el.addEventListener('click', () => {
      hideContextMenu();
      if (item.action) item.action();
    });
    menu.appendChild(el);
  });

  menu.classList.add('show');
  
  // Position
  let x = e.clientX;
  let y = e.clientY;

  // Make sure it doesn't overflow right/bottom
  const rect = menu.getBoundingClientRect();
  if (x + rect.width > window.innerWidth) x -= rect.width;
  if (y + rect.height > window.innerHeight) y -= rect.height;

  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  _currentContextMenu = menu;
}

export function hideContextMenu() {
  if (_currentContextMenu) {
    _currentContextMenu.classList.remove('show');
    _currentContextMenu = null;
  }
}

// Global click to hide context menu
document.addEventListener('click', hideContextMenu);
document.addEventListener('scroll', hideContextMenu, { capture: true });
