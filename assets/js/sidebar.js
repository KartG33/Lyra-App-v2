import { getFiles, loadFile, deleteFile, renameFile } from './storage.js';
import { filterPairs } from './render.js';
import { confirmModal, showContextMenu, toast } from './ui.js';

let observer = null;
let _onFileSelect = null;
let _activeFileId = null;
let _dragFileId = null;

export function initSidebar(onFileSelect) {
  _onFileSelect = onFileSelect;
  renderSidebar();
}

// ── MAIN RENDER ──────────────────────────────────────────────
export async function renderSidebar() {
  const navList = document.getElementById('nav-list');
  navList.innerHTML = '';

  const files = await getFiles();

  files.forEach(f => {
    navList.appendChild(buildFileItem(f));
  });

  // restore active file's nav
  if (_activeFileId) {
    const pairsNav = document.getElementById(`pairs-nav-${_activeFileId}`);
    if (pairsNav) pairsNav.style.display = 'block';
    const main = document.querySelector(`.file-item-main[data-id="${_activeFileId}"]`);
    if (main) main.classList.add('active');
  }
}

// ── BUILD FILE ITEM ──────────────────────────────────────────
function buildFileItem(f) {
  const item = document.createElement('div');
  item.className = 'file-item';
  item.dataset.id = f.id;
  item.dataset.search = (f.searchIndex || '').toLowerCase();

  item.innerHTML = `
    <div class="file-item-main" data-id="${f.id}">
      <div class="file-info">
        <div class="file-name" data-id="${f.id}">${esc(f.name)}</div>
        <div class="file-meta">${f.pairCount ? f.pairCount + ' зап.' : ''}</div>
      </div>
      <div class="file-actions">
        <button class="file-del" data-id="${f.id}" data-tooltip="Удалить">✕</button>
      </div>
    </div>
    <div class="file-pairs" id="pairs-nav-${f.id}" style="display:none"></div>
  `;

  // select file
  const mainEl = item.querySelector('.file-item-main');
  mainEl.addEventListener('click', e => {
    if (e.target.classList.contains('file-del')) return;
    if (e.target.classList.contains('file-name') && e.detail === 2) return;
    selectFile(f.id, mainEl);
  });

  // rename on dblclick
  item.querySelector('.file-name').addEventListener('dblclick', e => {
    e.stopPropagation();
    startRenameFile(f.id, e.target);
  });

  // delete
  item.querySelector('.file-del').addEventListener('click', async e => {
    e.stopPropagation();
    const ok = await confirmModal('Удалить файл?', `Файл "${f.name}" будет удален безвозвратно.`);
    if (ok) { 
      await deleteFile(f.id); 
      if (_activeFileId === f.id) _activeFileId = null; 
      toast('Файл удален');
      renderSidebar(); 
    }
  });

  // context menu
  mainEl.addEventListener('contextmenu', e => {
    showContextMenu(e, [
      { label: 'Переименовать', action: () => startRenameFile(f.id, item.querySelector('.file-name')) },
      'separator',
      { label: 'Удалить', danger: true, action: async () => {
        const ok = await confirmModal('Удалить файл?', `Файл "${f.name}" будет удален безвозвратно.`);
        if (ok) { await deleteFile(f.id); if (_activeFileId === f.id) _activeFileId = null; toast('Файл удален'); renderSidebar(); }
      }}
    ]);
  });

  return item;
}

// ── SELECT FILE ──────────────────────────────────────────────
async function selectFile(id, mainEl) {
  document.querySelectorAll('.file-item-main').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.file-pairs').forEach(el => el.style.display = 'none');
  mainEl.classList.add('active');
  _activeFileId = id;

  const pairsNav = document.getElementById(`pairs-nav-${id}`);
  if (pairsNav) pairsNav.style.display = 'block';

  const saved = await loadFile(id);
  if (saved && _onFileSelect) _onFileSelect(saved.data, saved.name, id);
}

// ── RENAME FILE ──────────────────────────────────────────────
function startRenameFile(id, el) {
  const orig = el.textContent;
  const input = document.createElement('input');
  input.className = 'rename-input';
  input.value = orig;
  el.replaceWith(input);
  input.focus(); input.select();

  const commit = async () => {
    const val = input.value.trim() || orig;
    await renameFile(id, val);
    renderSidebar();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { input.value = orig; commit(); }
  });
}



// ── NAV / OBSERVER ───────────────────────────────────────────
export function buildNav(pairs, fileId) {
  const pairsNav = document.getElementById(`pairs-nav-${fileId}`);
  if (!pairsNav) return;

  const artists = [...new Set(pairs.map(p => p.artist).filter(Boolean))];
  let filterHTML = '';
  if (artists.length > 1) {
    filterHTML = `
      <div class="artist-filter">
        <span class="artist-chip active" data-artist="">все</span>
        ${artists.map(a => `<span class="artist-chip" data-artist="${esc(a.toLowerCase())}">${esc(a)}</span>`).join('')}
      </div>`;
  }

  pairsNav.innerHTML = filterHTML;

  pairs.forEach(({ artist, theme, idx }) => {
    const navItem = document.createElement('div');
    navItem.className = 'nav-item';
    navItem.dataset.idx = idx;
    navItem.dataset.artist = (artist || '').toLowerCase();
    const label = theme ? theme : (artist || '—');
    navItem.innerHTML = `<span class="nav-num">#${idx+1}</span><span class="nav-artist">${esc(label)}</span>`;
    navItem.addEventListener('click', () => {
      document.getElementById(`pair-${idx}`)?.scrollIntoView({ behavior: 'smooth' });
      closeSidebar();
    });
    pairsNav.appendChild(navItem);
  });

  pairsNav.querySelectorAll('.artist-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      pairsNav.querySelectorAll('.artist-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const artist = chip.dataset.artist;
      pairsNav.querySelectorAll('.nav-item').forEach(it => {
        it.style.display = (!artist || it.dataset.artist === artist) ? '' : 'none';
      });
    });
  });
}

export function initObserver() {
  if (observer) observer.disconnect();
  observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const idx = entry.target.id.replace('pair-', '');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const active = document.querySelector(`.nav-item[data-idx="${idx}"]`);
        if (active) { active.classList.add('active'); active.scrollIntoView({ block: 'nearest' }); }
      }
    });
  }, { rootMargin: '-15% 0px -70% 0px' });
  document.querySelectorAll('.pair').forEach(p => observer.observe(p));
}

export function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const bg = document.getElementById('burger');
  const ov = document.getElementById('overlay');
  const isMobile = window.innerWidth <= 720;

  if (isMobile) {
    const open = sb.classList.toggle('open');
    bg.classList.toggle('open', open);
    ov.classList.toggle('visible', open);
    sb.classList.remove('collapsed');
  } else {
    const collapsed = sb.classList.toggle('collapsed');
    bg.classList.toggle('open', !collapsed);
  }
}

export function closeSidebar() {
  const sb = document.getElementById('sidebar');
  const bg = document.getElementById('burger');
  const ov = document.getElementById('overlay');
  
  sb.classList.remove('open');
  bg.classList.remove('open');
  ov.classList.remove('visible');
  
  // if on desktop and it was collapsed, we usually don't want to auto-uncollapse on click elsewhere
  // but if it's mobile, we definitely want to hide the overlay
}

export function filterSidebarFiles(q) {
  const query = (q || '').toLowerCase();
  let visibleCount = 0;
  document.querySelectorAll('.file-item').forEach(el => {
    const text = el.dataset.search || '';
    if (!query || text.includes(query)) {
      el.style.display = '';
      visibleCount++;
    } else {
      el.style.display = 'none';
    }
  });
  return visibleCount;
}

// export for app.js
export { renderSidebar as renderFileList };

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
