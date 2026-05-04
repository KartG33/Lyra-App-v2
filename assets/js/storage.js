const DB_KEY  = 'lyra_files_v3';
const LIB_KEY = 'lyra_libs_v1';

// ── DB HELPERS ───────────────────────────────────────────────
function getDB() {
  try { return JSON.parse(localStorage.getItem(DB_KEY) || '[]'); }
  catch { return []; }
}
function saveDB(db) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  catch(e) { console.warn('LYRA storage:', e); }
}

function getLibDB() {
  try { return JSON.parse(localStorage.getItem(LIB_KEY) || '[]'); }
  catch { return []; }
}
function saveLibDB(db) {
  try { localStorage.setItem(LIB_KEY, JSON.stringify(db)); }
  catch(e) { console.warn('LYRA lib storage:', e); }
}

// ── AUTO NAME ────────────────────────────────────────────────
function autoName(jsonData) {
  // Try exportedAt first, then current date
  let d;
  try {
    const parsed = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    d = parsed.exportedAt ? new Date(parsed.exportedAt) : new Date();
  } catch { d = new Date(); }
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

// ── FILES API ────────────────────────────────────────────────
export function saveFile(jsonStr, _originalFilename, pairCount) {
  const db = getDB();
  const name = autoName(jsonStr);
  // allow duplicates by date — add suffix if needed
  let finalName = name;
  let suffix = 2;
  while (db.find(f => f.name === finalName)) {
    finalName = `${name} (${suffix++})`;
  }
  const id = 'f_' + Date.now();
  db.unshift({ id, name: finalName, data: jsonStr, savedAt: Date.now(), pairCount: pairCount || 0, libId: null });
  saveDB(db);
  return id;
}

export function getFiles() {
  return getDB().map(({ id, name, savedAt, pairCount, libId }) => ({ id, name, savedAt, pairCount: pairCount||0, libId: libId||null }));
}

export function loadFile(id) {
  const f = getDB().find(f => f.id === id);
  if (!f) return null;
  try { return { data: JSON.parse(f.data), name: f.name }; }
  catch { return null; }
}

export function deleteFile(id) {
  saveDB(getDB().filter(f => f.id !== id));
}

export function renameFile(id, newName) {
  const db = getDB();
  const f = db.find(f => f.id === id);
  if (f) { f.name = newName; saveDB(db); }
}

export function moveFileToLib(fileId, libId) {
  const db = getDB();
  const f = db.find(f => f.id === fileId);
  if (f) { f.libId = libId || null; saveDB(db); }
}

export function getLastFileId() {
  const db = getDB();
  return db.length ? db[0].id : null;
}

// ── LIBRARIES API ────────────────────────────────────────────
export function getLibraries() {
  return getLibDB();
}

export function createLibrary(name) {
  const db = getLibDB();
  const id = 'lib_' + Date.now();
  db.push({ id, name, createdAt: Date.now() });
  saveLibDB(db);
  return id;
}

export function renameLibrary(id, newName) {
  const db = getLibDB();
  const lib = db.find(l => l.id === id);
  if (lib) { lib.name = newName; saveLibDB(db); }
}

export function deleteLibrary(id) {
  // unassign files from this library
  const db = getDB();
  db.forEach(f => { if (f.libId === id) f.libId = null; });
  saveDB(db);
  saveLibDB(getLibDB().filter(l => l.id !== id));
}

export function loadSaved() { return null; }
