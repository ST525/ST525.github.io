// Screenplay element types and the rules for moving between them.

export const TYPES = ['scene', 'action', 'character', 'parenthetical', 'dialogue', 'transition'];

export const FORMATS = ['hollywood', 'tw'];

export const PLACEHOLDERS = {
  hollywood: {
    scene: 'INT. LOCATION - DAY',
    action: 'Action',
    character: 'CHARACTER',
    parenthetical: '(parenthetical)',
    dialogue: 'Dialogue',
    transition: 'CUT TO:',
  },
  tw: {
    scene: '第1場　景：內／工作室　時：夜',
    action: '動作描述',
    character: '角色',
    parenthetical: '（OS）',
    dialogue: '對白',
    transition: '轉場',
  },
};

// Element that follows when Enter is pressed at the end of a non-empty element
// (WriterDuet's "traditional" flow: Character → Dialogue → back to Action).
export const NEXT_ON_ENTER = {
  scene: 'action',
  action: 'action',
  character: 'dialogue',
  parenthetical: 'dialogue',
  dialogue: 'action',
  transition: 'scene',
};

// Enter on an empty element opens the element picker with this type highlighted.
export const ON_EMPTY_ENTER = {
  scene: 'action',
  action: 'scene',
  character: 'action',
  parenthetical: 'dialogue',
  dialogue: 'action',
  transition: 'scene',
};

// Tab on an empty element changes its type.
export const TAB_ON_EMPTY = {
  scene: 'action',
  action: 'character',
  character: 'transition',
  parenthetical: 'dialogue',
  dialogue: 'parenthetical',
  transition: 'scene',
};

// Tab at the end of a non-empty element starts a new element of this type.
export const TAB_AT_END = {
  scene: 'action',
  action: 'character',
  character: 'parenthetical',
  parenthetical: 'dialogue',
  dialogue: 'character',
  transition: 'scene',
};

// Approximate characters per line and lines per page for each format.
export const PAGE_METRICS = {
  hollywood: {
    width: { scene: 60, action: 60, character: 38, parenthetical: 24, dialogue: 35, transition: 60 },
    linesPerPage: 55,
    inlineCharacter: false,
  },
  tw: {
    width: { scene: 36, action: 34, character: 6, parenthetical: 30, dialogue: 30, transition: 36 },
    linesPerPage: 34,
    inlineCharacter: true,
  },
};

export const UPPERCASE_TYPES = new Set(['scene', 'character', 'transition']);

const SCENE_RE = /^(INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]/i;
const SCENE_ZH_RE = /^[△]?\s*第\s*[\d０-９一二三四五六七八九十百零〇]+\s*[場场幕集]/;
const TRANSITION_RE = /^(FADE (IN|OUT|TO)|CUT TO|DISSOLVE TO|SMASH CUT|MATCH CUT|JUMP CUT|TIME CUT|WIPE TO|IRIS (IN|OUT))\b/i;
// 「小明：你好」 — a speaker name (no spaces / punctuation, up to 12 chars) followed by a colon.
const TW_SPEAKER_RE = /^△?\s*([^：:\s△（）()「」]{1,12})\s*[：:]\s*([\s\S]*)$/;

export function isSceneHeading(text) {
  return SCENE_RE.test(text) || SCENE_ZH_RE.test(text);
}

export function isTransition(text) {
  const t = text.trim();
  return TRANSITION_RE.test(t) || /TO:$/.test(t) || /^FADE (IN|OUT)[.:]?$/i.test(t);
}

export function looksLikeCharacter(text) {
  const t = text.trim();
  if (!t || t.length > 40) return false;
  if (!/[A-Z]/.test(t)) return false;
  if (t !== t.toUpperCase()) return false;
  if (/[.!?,;]$/.test(t)) return false;
  return !isSceneHeading(t) && !isTransition(t);
}

// In Taiwan format, "小明：你好" typed on one line is a speaker plus their dialogue.
export function splitSpeaker(text) {
  const m = text.match(TW_SPEAKER_RE);
  if (!m || isSceneHeading(text)) return null;
  return { name: m[1], dialogue: m[2].trim() };
}

// Given the text of an element the user just finished, guess what it really is.
export function detectType(text, currentType) {
  const t = text.trim();
  if (!t) return currentType;
  if (currentType === 'dialogue') return /^[（(].*[）)]$/.test(t) ? 'parenthetical' : currentType;
  if (currentType === 'character' || currentType === 'parenthetical') {
    if (isTransition(t)) return 'transition';
    if (isSceneHeading(t)) return 'scene';
    return currentType;
  }
  if (currentType !== 'action') return currentType;
  if (isSceneHeading(t)) return 'scene';
  if (isTransition(t)) return 'transition';
  if (looksLikeCharacter(t)) return 'character';
  return currentType;
}

export function nextType(type) {
  return TYPES[(TYPES.indexOf(type) + 1) % TYPES.length];
}

export function prevType(type) {
  return TYPES[(TYPES.indexOf(type) - 1 + TYPES.length) % TYPES.length];
}

// Normalize text for export / print: uppercase where the format demands it, wrap parentheticals.
export function displayText(type, text, format = 'hollywood') {
  let t = text.replace(/\u200b/g, '');
  if (format === 'tw') {
    if (type === 'parenthetical') {
      t = t.trim();
      if (t && !/^[（(]/.test(t)) t = '（' + t;
      if (t && !/[）)]$/.test(t)) t = t + '）';
    }
    return t;
  }
  if (UPPERCASE_TYPES.has(type)) t = t.toUpperCase();
  if (type === 'parenthetical') {
    t = t.trim();
    if (t && !t.startsWith('(')) t = '(' + t;
    if (t && !t.endsWith(')')) t = t + ')';
  }
  return t;
}

export function estimateLines(blocks, format = 'hollywood') {
  const m = PAGE_METRICS[format] || PAGE_METRICS.hollywood;
  let lines = 0;
  let prev = null;
  blocks.forEach((b, i) => {
    const width = m.width[b.type] || 60;
    const text = b.text || '';
    const next = blocks[i + 1];
    if (m.inlineCharacter && b.type === 'character' && next && (next.type === 'dialogue' || next.type === 'parenthetical')) {
      prev = b.type;
      return; // shares a line with the dialogue that follows
    }
    const physical = text.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / width)), 0);
    const attached = (b.type === 'dialogue' || b.type === 'parenthetical') &&
      (prev === 'character' || prev === 'parenthetical' || prev === 'dialogue');
    const gap = m.inlineCharacter ? (b.type === 'scene' && prev !== null ? 1 : 0) : (attached || prev === null ? 0 : 1);
    lines += physical + gap;
    prev = b.type;
  });
  return lines;
}

export function estimatePages(blocks, format = 'hollywood') {
  const m = PAGE_METRICS[format] || PAGE_METRICS.hollywood;
  return Math.max(1, Math.ceil(estimateLines(blocks, format) / m.linesPerPage));
}
