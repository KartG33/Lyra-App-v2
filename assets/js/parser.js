// ── KNOWN PARAM KEYS in order ────────────────────────────────
const KEYS = [
  'artist_name',
  'core_theme',
  'optional_mood_tag',
  'banned_words',
  'length_hint',
  'explicit_language',
  'rhyme_density',
  'rhyme_complexity',
  'rhyme_schemes',
];

const PLACEMENT_KW = ['end rhyme', 'internal rhyme', 'cross-line rhyme'];
const QUALITY_KW   = ['slant rhyme', 'assonance', 'multisyllabic rhyme', 'perfect rhyme', 'consonance', 'identical rhyme', 'mosaic rhyme'];
const POETIC_KW    = ['free verse', 'free/irregular', 'sonnet', 'narrative', 'ballad', 'elegy', 'haiku'];
const isPattern    = s => /ABAB|ABCC|ABCA|ABBA|ABCCA|ABCCB|alternating/i.test(s);

export function parseUser(raw) {
  const params = {};

  for (let i = 0; i < KEYS.length; i++) {
    const key = KEYS[i];
    const keyRe = new RegExp(`(?:^|,\\s*)${key.replace(/_/g, '[\\s_]')}\\s*:`, 'i');
    const km = raw.match(keyRe);
    if (!km) continue;

    const valStart = raw.indexOf(km[0]) + km[0].length;
    let valEnd;

    if (i < KEYS.length - 1) {
      const nextKey = KEYS[i + 1];
      const nextRe = new RegExp(`(?:,\\s*)${nextKey.replace(/_/g, '[\\s_]')}\\s*:`, 'i');
      const nkm = raw.slice(valStart).match(nextRe);
      valEnd = nkm ? raw.indexOf(nkm[0], valStart) : raw.length;
    } else {
      const nl = raw.indexOf('\n', valStart);
      valEnd = nl !== -1 ? nl : raw.length;
    }

    params[key] = raw.slice(valStart, valEnd).trim().replace(/,\s*$/, '').trim();
  }

  // PROMPT = everything after rhyme_schemes value
  let promptStart = raw.length;
  const rsRe = new RegExp(`(?:^|,\\s*)rhyme[\\s_]schemes\\s*:`, 'i');
  const rsm = raw.match(rsRe);
  if (rsm) {
    const rsValStart = raw.indexOf(rsm[0]) + rsm[0].length;
    const nl = raw.indexOf('\n', rsValStart);
    promptStart = nl !== -1 ? nl : raw.length;
  }
  const prompt = raw.slice(promptStart).replace(/^[\s,]+/, '').trim();

  // Split rhyme_schemes into sub-groups
  const allSchemes = (params['rhyme_schemes'] || '').split(',').map(s => s.trim()).filter(Boolean);

  return {
    artist_name:      params['artist_name']      || '',
    core_theme:       params['core_theme']        || '',
    mood_tag:         params['optional_mood_tag'] || '',
    banned_words:     params['banned_words']      || '',
    length:           params['length_hint']       || '',
    explicit:         params['explicit_language'] || '',
    rhyme_density:    params['rhyme_density']     || '',
    rhyme_complexity: params['rhyme_complexity']  || '',
    rhyme_placement:  allSchemes.filter(s => PLACEMENT_KW.some(k => s.toLowerCase().includes(k))).join(', '),
    rhyme_quality:    allSchemes.filter(s => QUALITY_KW.some(k => s.toLowerCase().includes(k))).join(', '),
    struct_patterns:  allSchemes.filter(s => isPattern(s)).join(', '),
    poetic_forms:     allSchemes.filter(s => POETIC_KW.some(k => s.toLowerCase().includes(k))).join(', '),
    prompt,
  };
}

export function parseAssistant(raw) {
  const mm = raw.match(/^\[Model:\s*(.+?)\s*\|\s*Temperature:\s*([\d.]+)\s*\|\s*Top P:\s*([\d.]+)\]/);
  const modelInfo = mm
    ? `Model: ${mm[1]}  |  Temperature: ${mm[2]}  |  Top P: ${mm[3]}`
    : '';
  let rest = mm ? raw.slice(mm[0].length).trimStart() : raw;

  const si = rest.search(/\[(?:Intro|Verse|Chorus|Bridge|Outro|Hook|Pre.Chorus|Post.Chorus)/i);
  let production = '', lyrics = rest;
  if (si !== -1) {
    production = rest.slice(0, si).trim();
    lyrics = rest.slice(si).trim();
  } else {
    const nl2 = rest.indexOf('\n\n');
    if (nl2 !== -1) {
      production = rest.slice(0, nl2).trim();
      lyrics = rest.slice(nl2 + 2).trim();
    }
  }

  return { modelInfo, production, lyrics };
}
