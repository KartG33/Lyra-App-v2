import { parseUser } from './parser.js';

const DB_NAME = 'LyraDB';
const STORE_NAME = 'files';
const DB_VERSION = 1;

let dbPromise = null;

export function initDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('savedAt', 'savedAt', { unique: false });
        }
      };
      
      request.onsuccess = async (e) => {
        const db = e.target.result;
        // Check local storage migration
        try {
          const oldDb = JSON.parse(localStorage.getItem('lyra_files_v3') || '[]');
          if (oldDb.length > 0) {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            for (const f of oldDb) {
              store.put({
                id: f.id,
                name: f.name,
                data: f.data,
                savedAt: f.savedAt || Date.now(),
                pairCount: f.pairCount || 0,
                searchIndex: (f.name + ' ' + f.data).toLowerCase()
              });
            }
            await new Promise(r => { tx.oncomplete = r; tx.onerror = r; });
            localStorage.removeItem('lyra_files_v3');
          }
        } catch(err) {
          console.warn('Migration error', err);
        }
        resolve(db);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

// ── AUTO NAME & INDEX ────────────────────────────────────────
function processJsonData(jsonData) {
  let dateStr = '';
  let artists = new Set();
  let themes = new Set();
  let searchParts = [];
  
  try {
    const parsed = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    const d = parsed.exportedAt ? new Date(parsed.exportedAt) : new Date();
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const hh = String(d.getHours()).padStart(2,'0');
    const min = String(d.getMinutes()).padStart(2,'0');
    dateStr = `${dd}.${mm} ${hh}:${min}`;
    
    if (parsed.messages) {
      for (let i = 0; i < parsed.messages.length; i++) {
        const m = parsed.messages[i];
        if (m.role === 'user') {
          const u = parseUser(m.content);
          if (u.artist_name) artists.add(u.artist_name);
          if (u.core_theme) themes.add(u.core_theme);
          searchParts.push(u.artist_name || '');
          searchParts.push(u.core_theme || '');
        } else if (m.role === 'assistant') {
          searchParts.push(m.content.slice(0, 300));
        }
      }
    }
  } catch (e) {
    const d = new Date();
    dateStr = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
  }

  const artistArr = Array.from(artists).filter(Boolean).slice(0, 1);
  const themeArr = Array.from(themes).filter(Boolean).slice(0, 1);
  
  let mainName = '';
  if (artistArr.length > 0 && themeArr.length > 0) {
    mainName = `${artistArr[0]} - ${themeArr[0]}`;
  } else if (themeArr.length > 0) {
    mainName = themeArr[0];
  } else if (artistArr.length > 0) {
    mainName = artistArr[0];
  } else {
    mainName = dateStr;
  }

  // Truncate if too long
  if (mainName.length > 45) {
    mainName = mainName.slice(0, 42) + '...';
  }

  // Add date if not already the only name
  let finalName = mainName === dateStr ? dateStr : `${mainName} (${dateStr})`;
  
  return { 
    name: finalName, 
    searchIndex: searchParts.join(' ').toLowerCase() 
  };
}

// ── FILES API ────────────────────────────────────────────────
export async function saveFile(jsonStr, _originalFilename, pairCount) {
  const db = await initDB();
  const { name, searchIndex } = processJsonData(jsonStr);
  
  // ensure unique name
  let finalName = name;
  let suffix = 2;
  
  const existingFiles = await getFiles();
  while (existingFiles.find(f => f.name === finalName)) {
    finalName = `${name} (${suffix++})`;
  }
  
  const id = 'f_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  const fileObj = {
    id,
    name: finalName,
    data: jsonStr,
    savedAt: Date.now(),
    pairCount: pairCount || 0,
    searchIndex: finalName.toLowerCase() + ' ' + searchIndex
  };
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(fileObj);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getFiles() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('savedAt');
    const request = index.getAll();
    
    request.onsuccess = () => {
      // IndexedDB getAll from index returns sorted by savedAt ascending. We want descending.
      const files = request.result.reverse().map(f => ({
        id: f.id,
        name: f.name,
        savedAt: f.savedAt,
        pairCount: f.pairCount || 0,
        searchIndex: f.searchIndex || ''
      }));
      resolve(files);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function loadFile(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => {
      const f = request.result;
      if (!f) return resolve(null);
      try {
        resolve({ data: JSON.parse(f.data), name: f.name });
      } catch {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteFile(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function renameFile(id, newName) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    
    getReq.onsuccess = () => {
      const f = getReq.result;
      if (f) {
        f.name = newName;
        store.put(f);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLastFileId() {
  const files = await getFiles();
  return files.length > 0 ? files[0].id : null;
}

export async function loadSaved() { return null; }
