// Autocomplete candidates for the line being typed, WriterDuet-style:
// character names and extensions, scene headings (prefix → location → time), transitions.

const EXTENSIONS = { hollywood: ['V.O.', 'O.S.', 'O.C.', 'SUBTITLE', "CONT'D"], tw: ['OS', 'VO'] };
const SCENE_PREFIXES = ['INT. ', 'EXT. ', 'INT./EXT. ', 'EST. '];
const TIMES = {
  hollywood: ['DAY', 'NIGHT', 'MORNING', 'AFTERNOON', 'EVENING', 'DAWN', 'DUSK', 'CONTINUOUS', 'LATER', 'MOMENTS LATER'],
  tw: ['日', '夜', '晨', '黃昏', '清晨', '傍晚', '深夜'],
};
const TW_PLACES = ['內／', '外／', '內外／'];
const TRANSITIONS = {
  hollywood: ['CUT TO:', 'DISSOLVE TO:', 'SMASH CUT TO:', 'MATCH CUT TO:', 'JUMP CUT TO:', 'FADE OUT.', 'FADE TO BLACK.'],
  tw: ['剪接', '溶接', '淡入', '淡出', '跳接'],
};

const EN_PREFIX_RE = /^(INT\.?\/EXT\.?|I\/E\.?|INT\.|EXT\.|EST\.)\s+/i;
const EN_DASH_RE = /\s+[-–—]\s*/;

// "JOHN (V.O.)" → "JOHN", "小明（OS）" → "小明"
export function baseName(text) {
  return text.replace(/\s*[(（][^)）]*[)）]?\s*$/, '').trim();
}

function byFrequency(values) {
  const counts = new Map();
  for (const v of values) if (v) counts.set(v, (counts.get(v) || 0) + 1);
  return [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a));
}

function startsWith(candidate, query) {
  const c = candidate.toUpperCase();
  const q = query.toUpperCase();
  return c.startsWith(q) && c !== q;
}

function matches(candidates, query, toValue = (c) => c, final = true) {
  return candidates
    .filter((c) => startsWith(c, query))
    .slice(0, 8)
    .map((c) => ({ label: c, value: toValue(c), final }));
}

export function characterNames(blocks, format) {
  const names = blocks
    .filter((b) => b.type === 'character')
    .map((b) => baseName(b.text))
    .map((n) => (format === 'hollywood' ? n.toUpperCase() : n));
  return byFrequency(names);
}

// Alternate speakers: after A / B / A, the next line is probably B.
export function nextSpeaker(previousBlocks) {
  const seen = [];
  for (let i = previousBlocks.length - 1; i >= 0 && seen.length < 2; i--) {
    const b = previousBlocks[i];
    if (b.type === 'scene') break;
    if (b.type !== 'character') continue;
    const name = baseName(b.text);
    if (name && !seen.some((s) => s.toUpperCase() === name.toUpperCase())) seen.push(name);
  }
  return seen.length === 2 ? seen[1] : null;
}

function enScenePart(text) {
  const prefix = text.match(EN_PREFIX_RE);
  if (!prefix) return null;
  const rest = text.slice(prefix[0].length);
  const dash = rest.match(EN_DASH_RE);
  return {
    head: prefix[0],
    location: dash ? rest.slice(0, dash.index) : rest,
    time: dash ? rest.slice(dash.index + dash[0].length) : null,
  };
}

function twScenePart(text) {
  const m = text.match(/景：(.*?)(?:\s*時：(.*))?$/);
  return m ? { location: m[1].trim(), time: m[2] === undefined ? null : m[2].trim() } : null;
}

function sceneSuggestions(text, ctx) {
  const scenes = ctx.blocks.filter((b) => b.type === 'scene').map((b) => b.text);

  if (ctx.format === 'tw') {
    const parts = scenes.map(twScenePart).filter(Boolean);
    if (/^\s*第?\s*[\d０-９]*\s*$/.test(text)) {
      const head = `第${ctx.sceneNumber}場　景：`;
      return startsWith(head, text) ? [{ label: head, value: head, final: false }] : [];
    }
    const timeAt = text.lastIndexOf('時：');
    if (timeAt >= 0) {
      const used = byFrequency(parts.map((p) => p.time));
      const times = [...new Set([...TIMES.tw, ...used])];
      return matches(times, text.slice(timeAt + 2), (c) => text.slice(0, timeAt + 2) + c);
    }
    const locAt = text.indexOf('景：');
    if (locAt < 0) return [];
    const head = text.slice(0, locAt + 2);
    const loc = text.slice(locAt + 2);
    const places = [...new Set([...byFrequency(parts.map((p) => p.location)), ...TW_PLACES])];
    return matches(places, loc, (c) => head + c + (c.endsWith('／') ? '' : '　時：'), false);
  }

  const part = enScenePart(text);
  if (!part) return matches(SCENE_PREFIXES, text, (c) => c, false);
  const parts = scenes.map(enScenePart).filter(Boolean);
  if (part.time === null) {
    const locations = byFrequency(parts.map((p) => p.location.trim().toUpperCase()));
    return matches(locations, part.location, (c) => part.head.toUpperCase() + c + ' - ', false);
  }
  const used = byFrequency(parts.map((p) => (p.time || '').trim().toUpperCase()));
  const times = [...new Set([...TIMES.hollywood, ...used])];
  const head = part.head.toUpperCase() + part.location.trim() + ' - ';
  return matches(times, part.time, (c) => head + c);
}

// ctx: { format, blocks (the rest of the script), sceneNumber }
export function suggestionsFor(type, text, ctx) {
  const format = ctx.format === 'tw' ? 'tw' : 'hollywood';
  if (type === 'character') {
    const ext = text.match(/^(.*?\S)\s*[(（]([^)）]*)$/);
    if (ext) {
      const wrap = format === 'tw' ? (x) => `${ext[1]}（${x}）` : (x) => `${ext[1]} (${x})`;
      return EXTENSIONS[format]
        .filter((x) => x.toUpperCase().startsWith(ext[2].toUpperCase()))
        .map((x) => ({ label: wrap(x), value: wrap(x), final: true }));
    }
    if (!text.trim()) return [];
    return matches(characterNames(ctx.blocks, format), text);
  }
  if (type === 'scene') return sceneSuggestions(text, { ...ctx, format });
  // Starting an Action line like a scene heading ("第…", "INT") offers to turn it into one.
  if (type === 'action' && (format === 'tw' ? /^第/.test(text) : /^(INT|EXT|EST)/i.test(text))) {
    return sceneSuggestions(text, { ...ctx, format }).map((item) => ({ ...item, type: 'scene' }));
  }
  if (type === 'transition') {
    if (!text.trim()) return TRANSITIONS[format].map((c) => ({ label: c, value: c, final: true }));
    return matches(TRANSITIONS[format], text);
  }
  return [];
}
