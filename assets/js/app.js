import { renderPairs, filterPairs } from './render.js';
import { buildNav, initObserver, toggleSidebar, closeSidebar, initSidebar, renderFileList, filterSidebarFiles } from './sidebar.js';
import { saveFile, loadFile, getLastFileId } from './storage.js';
import { toast } from './ui.js';

// ── PWA ──────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/LYRA-APP/sw.js').catch(() => {});
  });
}

// ── FILE INPUT ───────────────────────────────────────────────
const fileInput = document.getElementById('file-input');
document.getElementById('btn-load').addEventListener('click', () => fileInput.click());
document.getElementById('btn-upload').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

const uploadScreen = document.getElementById('upload-screen');
uploadScreen.addEventListener('dragover', e => { e.preventDefault(); uploadScreen.classList.add('over'); });
uploadScreen.addEventListener('dragleave', () => uploadScreen.classList.remove('over'));
uploadScreen.addEventListener('drop', e => {
  e.preventDefault(); uploadScreen.classList.remove('over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

function countPairs(messages) {
  let n = 0;
  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].role==='user' && messages[i+1].role==='assistant') { n++; i++; }
  }
  return n;
}

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const jsonStr = e.target.result;
      const data = JSON.parse(jsonStr);
      const pairCount = countPairs(data.messages || []);
      const id = await saveFile(jsonStr, file.name, pairCount);
      await renderFileList();
      await loadData(data, id);
      // activate in sidebar
      requestAnimationFrame(() => {
        const main = document.querySelector(`.file-item-main[data-id="${id}"]`);
        if (main) {
          document.querySelectorAll('.file-item-main').forEach(el => el.classList.remove('active'));
          main.classList.add('active');
          const pairsNav = document.getElementById(`pairs-nav-${id}`);
          if (pairsNav) {
            document.querySelectorAll('.file-pairs').forEach(el => el.style.display = 'none');
            pairsNav.style.display = 'block';
          }
        }
      });
    } catch (err) { 
      toast('Ошибка загрузки или неверный формат JSON', 'error'); 
    }
  };
  reader.readAsText(file);
}

// ── LOAD DATA ────────────────────────────────────────────────
async function loadData(data, fileId) {
  const messages = data.messages || [];
  const exp = data.exportedAt ? new Date(data.exportedAt).toLocaleString('ru-RU') : '';
  const pairCount = countPairs(messages);

  // get display name from storage
  const saved = await loadFile(fileId);
  const displayName = saved ? saved.name : '';

  document.getElementById('header-file').innerHTML =
    `<strong>${esc(displayName)}</strong> · ${pairCount} запрос${pairCount===1?'':'ов'}${exp?' · '+exp:''}`;

  const searchEl = document.getElementById('search-input');
  if (searchEl) {
    const q = searchEl.value;
    filterPairs(q);
  }

  const navData = renderPairs(messages);
  buildNav(navData, fileId);
  initObserver();

  uploadScreen.style.display = 'none';
  document.getElementById('pairs-container').style.display = 'block';
}

// ── SEARCH ───────────────────────────────────────────────────
const searchInput = document.getElementById('search-input');
const searchCount = document.getElementById('search-count');
let searchTimer = null;

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const q = searchInput.value;
    const visiblePairs = filterPairs(q);
    const visibleFiles = filterSidebarFiles(q);
    
    if (q) { 
      searchCount.textContent = `${visiblePairs} в файле`; 
      searchCount.style.display = document.getElementById('pairs-container').style.display === 'block' ? 'inline' : 'none'; 
    }
    else searchCount.style.display = 'none';
  }, 180);
});
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') { 
    searchInput.value = ''; 
    filterPairs(''); 
    filterSidebarFiles('');
    searchCount.style.display = 'none'; 
  }
});

// ── INIT ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  initSidebar(async (data, _name, id) => await loadData(data, id));

  const lastId = await getLastFileId();
  if (lastId) {
    const saved = await loadFile(lastId);
    if (saved) {
      await loadData(saved.data, lastId);
      requestAnimationFrame(() => {
        const main = document.querySelector(`.file-item-main[data-id="${lastId}"]`);
        if (main) {
          main.classList.add('active');
          const pn = document.getElementById(`pairs-nav-${lastId}`);
          if (pn) pn.style.display = 'block';
        }
      });
    }
  }
});

document.getElementById('burger').addEventListener('click', toggleSidebar);
document.getElementById('overlay').addEventListener('click', closeSidebar);

// close move menus on doc click
document.addEventListener('click', () => {
  document.querySelectorAll('.move-menu.open').forEach(m => m.classList.remove('open'));
});

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
