import { getFiles, loadFile, deleteFile, renameFile, moveFileToLib,
         getLibraries, createLibrary, renameLibrary, deleteLibrary } from './storage.js';
import { filterPairs } from './render.js';

let observer = null;
let _onFileSelect = null;
let _activeFileId = null;
let _dragFileId = null;

export function initSidebar(onFileSelect) {
  _onFileSelect = onFileSelect;
  renderSidebar();
}

// ── MAIN RENDER ──────────────────────────────────────────────
export function renderSidebar() {
  const navList = document.getElementById('nav-list');
  navList.innerHTML = '';

  const libs  = getLibraries();
  const files = getFiles();

  // ── NEW LIBRARY BUTTON ──
  const addLibBtn = document.createElement('button');
  addLibBtn.className = 'btn-add-lib';
  addLibBtn.innerHTML = '+ библиотека';
  addLibBtn.addEventListener('click', () => {
    const name = prompt('Название библиотеки:');
    if (name && name.trim()) { createLibrary(name.trim()); renderSidebar(); }
  });
  navList.appendChild(addLibBtn);

  // ── LIBRARIES ──
  libs.forEach(lib => {
    const libFiles = files.filter(f => f.libId === lib.id);
    const section = document.createElement('div');
    section.className = 'lib-section';
    section.dataset.libId = lib.id;

    section.innerHTML = `
      <div class="lib-header" data-lib-id="${lib.id}">
        <span class="lib-arrow">▸</span>
        <span class="lib-name" data-lib-id="${lib.id}">${esc(lib.name)}</span>
        <span class="lib-count">${libFiles.length}</span>
        <button class="lib-del" data-lib-id="${lib.id}" title="Удалить">✕</button>
      </div>
      <div class="lib-files" id="lib-files-${lib.id}"></div>
    `;

    const libHeader = section.querySelector('.lib-header');
    const libFilesEl = section.querySelector('.lib-files');

    // collapse/expand
    libHeader.addEventListener('click', e => {
      if (e.target.classList.contains('lib-del')) return;
      if (e.target.classList.contains('lib-name') && e.detail === 2) return; // dblclick handled below
      section.classList.toggle('open');
    });

    // rename on dblclick
    section.querySelector('.lib-name').addEventListener('dblclick', e => {
      e.stopPropagation();
      startRenameLib(lib.id, e.target);
    });

    // delete library
    section.querySelector('.lib-del').addEventListener('click', e => {
      e.stopPropagation();
      if (confirm(`Удалить библиотеку "${lib.name}"? Файлы останутся.`)) {
        deleteLibrary(lib.id); renderSidebar();
      }
    });

    // drag-over for dropping files
    libFilesEl.addEventListener('dragover', e => { e.preventDefault(); section.classList.add('drag-over'); });
    libHeader.addEventListener('dragover', e => { e.preventDefault(); section.classList.add('drag-over'); });
    section.addEventListener('dragleave', e => {
      if (!section.contains(e.relatedTarget)) section.classList.remove('drag-over');
    });
    section.addEventListener('drop', e => {
      e.preventDefault();
      section.classList.remove('drag-over');
      if (_dragFileId) { moveFileToLib(_dragFileId, lib.id); _dragFileId = null; renderSidebar(); }
    });

    // render files inside lib
    if (libFiles.length) section.classList.add('open');
    libFiles.forEach(f => libFilesEl.appendChild(buildFileItem(f, libs)));

    navList.appendChild(section);
  });

  // ── UNCATEGORIZED FILES ──
  const uncategorized = files.filter(f => !f.libId);
  if (uncategorized.length) {
    const uncatSection = document.createElement('div');
    uncatSection.className = 'lib-section uncat-section open';
    uncatSection.innerHTML = `
      <div class="lib-header uncat-header">
        <span class="lib-arrow">▸</span>
        <span class="lib-name-plain">Без библиотеки</span>
        <span class="lib-count">${uncategorized.length}</span>
      </div>
      <div class="lib-files" id="lib-files-uncat"></div>
    `;
    uncatSection.querySelector('.lib-header').addEventListener('click', () => {
      uncatSection.classList.toggle('open');
    });

    // drop zone for uncat
    const uncatFiles = uncatSection.querySelector('.lib-files');
    uncatFiles.addEventListener('dragover', e => { e.preventDefault(); uncatSection.classList.add('drag-over'); });
    uncatSection.addEventListener('dragleave', e => {
      if (!uncatSection.contains(e.relatedTarget)) uncatSection.classList.remove('drag-over');
    });
    uncatSection.addEventListener('drop', e => {
      e.preventDefault(); uncatSection.classList.remove('drag-over');
      if (_dragFileId) { moveFileToLib(_dragFileId, null); _dragFileId = null; renderSidebar(); }
    });

    uncategorized.forEach(f => uncatFiles.appendChild(buildFileItem(f, libs)));
    navList.appendChild(uncatSection);
  }

  // restore active file's nav
  if (_activeFileId) {
    const pairsNav = document.getElementById(`pairs-nav-${_activeFileId}`);
    if (pairsNav) pairsNav.style.display = 'block';
    const main = document.querySelector(`.file-item-main[data-id="${_activeFileId}"]`);
    if (main) main.classList.add('active');
  }
}

// ── BUILD FILE ITEM ──────────────────────────────────────────
function buildFileItem(f, libs) {
  const item = document.createElement('div');
  item.className = 'file-item';
  item.dataset.id = f.id;
  item.draggable = true;

  item.innerHTML = `
    <div class="file-item-main" data-id="${f.id}">
      <span class="drag-handle">⠿</span>
      <div class="file-info">
        <div class="file-name" data-id="${f.id}">${esc(f.name)}</div>
        <div class="file-meta">${f.pairCount ? f.pairCount + ' зап.' : ''}</div>
      </div>
      <div class="file-actions">
        <div class="file-move-wrap">
          <button class="file-act-btn" title="Переместить" data-id="${f.id}">↗</button>
          <div class="move-menu" id="move-menu-${f.id}">
            ${libs.map(l => `<div class="move-item" data-file="${f.id}" data-lib="${l.id}">${esc(l.name)}</div>`).join('')}
            ${f.libId ? `<div class="move-item move-item-uncat" data-file="${f.id}" data-lib="">Без библиотеки</div>` : ''}
          </div>
        </div>
        <button class="file-del" data-id="${f.id}" title="Удалить">✕</button>
      </div>
    </div>
    <div class="file-pairs" id="pairs-nav-${f.id}" style="display:none"></div>
  `;

  // drag
  item.addEventListener('dragstart', e => {
    _dragFileId = f.id;
    e.dataTransfer.effectAllowed = 'move';
    item.classList.add('dragging');
  });
  item.addEventListener('dragend', () => item.classList.remove('dragging'));

  // select file
  const mainEl = item.querySelector('.file-item-main');
  mainEl.addEventListener('click', e => {
    if (e.target.classList.contains('file-del') ||
        e.target.classList.contains('file-act-btn') ||
        e.target.classList.contains('move-item') ||
        e.target.classList.contains('drag-handle')) return;
    if (e.target.classList.contains('file-name') && e.detail === 2) return;
    selectFile(f.id, mainEl);
  });

  // rename on dblclick
  item.querySelector('.file-name').addEventListener('dblclick', e => {
    e.stopPropagation();
    startRenameFile(f.id, e.target);
  });

  // delete
  item.querySelector('.file-del').addEventListener('click', e => {
    e.stopPropagation();
    if (confirm(`Удалить "${f.name}"?`)) { deleteFile(f.id); if (_activeFileId === f.id) _activeFileId = null; renderSidebar(); }
  });

  // move menu
  const moveBtn = item.querySelector('.file-act-btn');
  const moveMenu = item.querySelector('.move-menu');
  moveBtn.addEventListener('click', e => {
    e.stopPropagation();
    // close all other menus
    document.querySelectorAll('.move-menu.open').forEach(m => { if (m !== moveMenu) m.classList.remove('open'); });
    moveMenu.classList.toggle('open');
  });

  item.querySelectorAll('.move-item').forEach(mi => {
    mi.addEventListener('click', e => {
      e.stopPropagation();
      const libId = mi.dataset.lib || null;
      moveFileToLib(mi.dataset.file, libId);
      moveMenu.classList.remove('open');
      renderSidebar();
    });
  });

  // close move menu on outside click
  document.addEventListener('click', () => moveMenu.classList.remove('open'), { once: false, capture: false });

  return item;
}

// ── SELECT FILE ──────────────────────────────────────────────
function selectFile(id, mainEl) {
  document.querySelectorAll('.file-item-main').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.file-pairs').forEach(el => el.style.display = 'none');
  mainEl.classList.add('active');
  _activeFileId = id;

  const pairsNav = document.getElementById(`pairs-nav-${id}`);
  if (pairsNav) pairsNav.style.display = 'block';

  const saved = loadFile(id);
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

  const commit = () => {
    const val = input.value.trim() || orig;
    renameFile(id, val);
    renderSidebar();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { input.value = orig; commit(); }
  });
}

// ── RENAME LIBRARY ───────────────────────────────────────────
function startRenameLib(id, el) {
  const orig = el.textContent;
  const input = document.createElement('input');
  input.className = 'rename-input';
  input.value = orig;
  el.replaceWith(input);
  input.focus(); input.select();

  const commit = () => {
    const val = input.value.trim() || orig;
    renameLibrary(id, val);
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

  pairs.forEach(({ artist, idx }) => {
    const navItem = document.createElement('div');
    navItem.className = 'nav-item';
    navItem.dataset.idx = idx;
    navItem.dataset.artist = (artist || '').toLowerCase();
    navItem.innerHTML = `<span class="nav-num">#${idx+1}</span><span class="nav-artist">${esc(artist||'—')}</span>`;
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
  const open = sb.classList.toggle('open');
  bg.classList.toggle('open', open);
  ov.classList.toggle('visible', open);
}

export function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('burger').classList.remove('open');
  document.getElementById('overlay').classList.remove('visible');
}

// export for app.js
export { renderSidebar as renderFileList };

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
