import { parseUser, parseAssistant } from './parser.js';

let _id = 0;

export function renderPairs(messages) {
  const pairs = [];
  for (let i = 0; i < messages.length - 1; i++) {
    if (messages[i].role === 'user' && messages[i + 1].role === 'assistant') {
      pairs.push({ user: messages[i].content, assistant: messages[i + 1].content });
      i++;
    }
  }

  const container = document.getElementById('pairs-container');
  container.innerHTML = '';
  _id = 0;

  const navData = [];

  pairs.forEach((pair, idx) => {
    const u = parseUser(pair.user);
    const a = parseAssistant(pair.assistant);
    const isError = pair.assistant.toLowerCase().includes('something went wrong');

    navData.push({ artist: u.artist_name, theme: u.core_theme, idx });

    const el = document.createElement('div');
    el.className = 'pair';
    el.id = `pair-${idx}`;
    el.dataset.artist = (u.artist_name || '').toLowerCase();
    el.dataset.theme  = (u.core_theme  || '').toLowerCase();
    el.dataset.lyrics = (a.lyrics      || '').toLowerCase().slice(0, 300);
    el.style.animationDelay = `${idx * 0.04}s`;

    el.innerHTML = `
      <div class="pair-index">
        <span>— #${idx + 1} · ${esc(u.artist_name || '—')} —</span>
        ${!isError ? `<button class="btn-copy-all" onclick="window.__lyra_copy_all(${idx},this)">⎘ скопировать всё</button>` : ''}
      </div>

      <div class="card card-assistant">
        <div class="card-header">
          <span class="role-badge assistant">Lyrics</span>
          ${a.modelInfo ? `<span class="model-info-pill">${esc(a.modelInfo)}</span>` : ''}
        </div>
        <div class="card-body">
          ${isError
            ? `<div class="err-badge">⚠ Ошибка генерации</div>`
            : `
            ${a.production ? `
              <button class="btn-prod-toggle" onclick="window.__lyra_toggle_prod('prod-${idx}',this)">
                <span class="prod-arrow">▸</span> Production
              </button>
              <div class="prod-collapse" id="prod-${idx}">
                ${cb('', a.production, true)}
              </div>
            ` : ''}
            <div id="lyrics-${idx}">${cb('', a.lyrics, false, true)}</div>
          `}
        </div>
      </div>

      <button class="btn-show-request" onclick="window.__lyra_toggle_user('user-block-${idx}',this)">
        <span class="req-arrow">↓</span>
        <span class="req-label">показать запрос</span>
      </button>

      <div class="card card-user user-collapse" id="user-block-${idx}">
        <div class="card-header">
          <span class="role-badge user">User · Parameters</span>
        </div>
        <div class="card-body">
          <div class="sec-title u">Lyrics Settings</div>
          ${cb('Artist Name',       u.artist_name)}
          ${cb('Core Theme',        u.core_theme,    true)}
          ${cb('Mood Tag',          u.mood_tag,       true)}
          ${cb('Banned Words',      u.banned_words,   true)}
          ${cb('Length',            u.length)}
          ${cb('Explicit Language', u.explicit)}
          <div class="spacer"></div>
          <div class="sec-title u">Rhyme Controls</div>
          ${cb('Rhyme Density',     u.rhyme_density)}
          ${cb('Rhyme Complexity',  u.rhyme_complexity)}
          ${u.rhyme_placement ? cb('Rhyme Placement',    u.rhyme_placement,  true) : ''}
          ${u.rhyme_quality   ? cb('Rhyme Quality',      u.rhyme_quality,    true) : ''}
          ${u.struct_patterns ? cb('Structure Patterns', u.struct_patterns,  true) : ''}
          ${u.poetic_forms    ? cb('Poetic Forms',       u.poetic_forms,     true) : ''}
          <div class="spacer"></div>
          <div class="sec-title u">Prompt</div>
          ${cb('', u.prompt, false, true)}
        </div>
      </div>
    `;

    container.appendChild(el);
  });

  container.style.display = 'block';
  return navData;
}

function cb(label, value, scroll = false, large = false) {
  if (!value && value !== 0) return '';
  const id = 'cb' + (++_id);
  const cls = 'cb' + (large ? ' scroll-lg' : scroll ? ' scroll' : '');
  return `
    <div class="field">
      ${label ? `<div class="field-label">${esc(label)}</div>` : ''}
      <div class="${cls}" id="${id}">${esc(value)}<button class="cp" onclick="window.__lyra_copy('${id}',this)">copy</button></div>
    </div>`;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.__lyra_toggle_user = function(blockId, btn) {
  const block = document.getElementById(blockId);
  const isOpen = block.classList.toggle('open');
  btn.querySelector('.req-arrow').textContent = isOpen ? '↑' : '↓';
  btn.querySelector('.req-label').textContent = isOpen ? 'скрыть запрос' : 'показать запрос';
  btn.classList.toggle('active', isOpen);
};

window.__lyra_toggle_prod = function(blockId, btn) {
  const block = document.getElementById(blockId);
  const isOpen = block.classList.toggle('open');
  btn.querySelector('.prod-arrow').style.transform = isOpen ? 'rotate(90deg)' : 'rotate(0)';
  btn.classList.toggle('active', isOpen);
};

window.__lyra_copy_all = function(idx, btn) {
  const parts = [];
  const prod   = document.getElementById(`prod-${idx}`);
  const lyrics = document.getElementById(`lyrics-${idx}`);
  [['--- PRODUCTION ---', prod], ['--- LYRICS ---', lyrics]].forEach(([label, el]) => {
    if (!el) return;
    const clone = el.cloneNode(true);
    clone.querySelectorAll('.cp,.btn-prod-toggle').forEach(b => b.remove());
    const t = (clone.innerText || clone.textContent).trim();
    if (t) parts.push(label + '\n' + t);
  });
  navigator.clipboard.writeText(parts.join('\n\n')).then(() => {
    const orig = btn.innerHTML;
    btn.textContent = '✓ скопировано';
    btn.classList.add('ok');
    setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('ok'); }, 2000);
  });
};

window.__lyra_copy = function(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  const clone = el.cloneNode(true);
  clone.querySelectorAll('.cp').forEach(b => b.remove());
  navigator.clipboard.writeText((clone.innerText || clone.textContent).trim()).then(() => {
    btn.textContent = '✓ ok';
    btn.classList.add('ok');
    setTimeout(() => { btn.textContent = 'copy'; btn.classList.remove('ok'); }, 1800);
  });
};

export function filterPairs(query) {
  const q = (query || '').toLowerCase().trim();
  let visible = 0;
  document.querySelectorAll('.pair').forEach(pair => {
    const match = !q
      || (pair.dataset.artist || '').includes(q)
      || (pair.dataset.theme  || '').includes(q)
      || (pair.dataset.lyrics || '').includes(q);
    pair.style.display = match ? '' : 'none';
    if (match) visible++;
  });
  return visible;
}
