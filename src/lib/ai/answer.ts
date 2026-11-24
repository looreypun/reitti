import { normalize } from '../text';

/** Parses replies into paragraphs, bullets, headings, **bold** and [[place-id]] references. */
export type Inline = { type: 'text'; text: string } | { type: 'bold'; text: string } | { type: 'place'; id: string };
export type Block = { type: 'p' | 'li' | 'h'; inlines: Inline[] };

export function stripThinking(text: string): string {
  // removes <think> blocks, including an unfinished one while streaming
  return text.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trimStart();
}

export function parseInlines(text: string, isKnownPlace: (id: string) => boolean): Inline[] {
  // small models sometimes write "(id: [[x]])" or "([[x]])"; keep just the marker
  text = text.replace(/\s*\(\s*(?:id\s*:\s*)?(\[\[[a-z0-9-]+\]\])\s*\)/gi, ' $1');
  const out: Inline[] = [];
  const pushText = (t: string) => {
    const prev = out[out.length - 1];
    if (prev?.type === 'text') prev.text += t;
    else out.push({ type: 'text', text: t });
  };
  const re = /\*\*([^*]+)\*\*|\[\[([a-z0-9-]+)\]\]/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) pushText(text.slice(last, m.index));
    if (m[1] !== undefined) out.push({ type: 'bold', text: m[1] });
    else if (isKnownPlace(m[2])) out.push({ type: 'place', id: m[2] });
    // unknown ids are dropped
    last = re.lastIndex;
  }
  if (last < text.length) pushText(text.slice(last));
  // tidy spacing and hide a partially streamed "[[id"
  return out
    .map((i) => (i.type === 'text' ? { ...i, text: i.text.replace(/\[\[[a-z0-9-]*\]?$/, '').replace(/ {2,}/g, ' ') } : i))
    .filter((i) => i.type !== 'text' || i.text.length > 0);
}

export function parseAnswer(text: string, isKnownPlace: (id: string) => boolean): Block[] {
  const blocks: Block[] = [];
  for (const raw of stripThinking(text).split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (bullet) blocks.push({ type: 'li', inlines: parseInlines(bullet[1], isKnownPlace) });
    else if (heading) blocks.push({ type: 'h', inlines: parseInlines(heading[1].replace(/\*\*/g, ''), isKnownPlace) });
    else blocks.push({ type: 'p', inlines: parseInlines(line, isKnownPlace) });
  }
  return blocks;
}

export interface CitationCandidate {
  id: string;
  name: string;
  city?: string;
  estimated_cost_eur?: number;
  summary?: string;
  tags?: string[];
}

const NAME_FILLER = new Set(['the', 'and', 'with', 'from', 'for', 'of', 'at', 'in', 'on', 'to']);

function words(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !NAME_FILLER.has(w))
    .map((w) => (w.length > 4 && /[^s]s$/.test(w) ? w.slice(0, -1) : w)); // igloos -> igloo, glass stays
}

/**
 * Place ids referenced in a reply, in order of first mention. Small models often skip the
 * [[id]] markers or reword names, so besides markers and full names a place also counts when a line
 * - uses words only its name has: two of them ("glass igloo"), one plus its city ("Levi … snowmobile"),
 *   or one long name-like word ("Vapriikki"), or
 * - names its city together with its price, or its city when it is the only candidate there.
 */
export function citedPlaceIds(text: string, isKnownPlace: (id: string) => boolean, candidates: CitationCandidate[] = []): string[] {
  const clean = stripThinking(text);
  const hits: { id: string; at: number }[] = [];
  for (const m of clean.matchAll(/\[\[([a-z0-9-]+)\]\]/g)) if (isKnownPlace(m[1])) hits.push({ id: m[1], at: m.index ?? 0 });

  // name words that no other candidate uses in its name, summary or tags (city names excluded),
  // so "snowmobile" points at one place but a shared topic word like "aurora" does not
  const cityWords = new Set(candidates.flatMap((c) => (c.city ? words(c.city) : [])));
  const allWords = candidates.map((c) => new Set(words(`${c.name} ${c.summary ?? ''} ${(c.tags ?? []).join(' ')}`)));
  const count = new Map<string, number>();
  for (const set of allWords) for (const w of set) count.set(w, (count.get(w) ?? 0) + 1);
  const unique = candidates.map((c) => [...new Set(words(c.name))].filter((w) => !cityWords.has(w) && count.get(w) === 1));
  const perCity = new Map<string, number>();
  for (const c of candidates) if (c.city) perCity.set(c.city, (perCity.get(c.city) ?? 0) + 1);

  let offset = 0;
  for (const line of clean.split('\n')) {
    const lower = normalize(line);
    const lineWords = new Set(words(line));
    const prices = new Set([...line.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:€|eur)|€\s*(\d+(?:[.,]\d+)?)/gi)].map((m) => Number((m[1] ?? m[2]).replace(',', '.'))));
    candidates.forEach((c, i) => {
      let at = lower.indexOf(normalize(c.name));
      if (at < 0) {
        const found = unique[i].filter((w) => lineWords.has(w));
        const inCity = !!c.city && lower.includes(normalize(c.city));
        if (found.length >= 2 || (found.length === 1 && (inCity || found[0].length >= 8))) {
          at = Math.max(0, lower.search(new RegExp(`\\b${found[0]}`)));
        }
      }
      if (at < 0 && c.city && ((c.estimated_cost_eur && prices.has(c.estimated_cost_eur)) || perCity.get(c.city) === 1)) {
        at = lower.indexOf(normalize(c.city));
      }
      if (at >= 0) hits.push({ id: c.id, at: offset + at });
    });
    offset += line.length + 1;
  }
  return [...new Set(hits.sort((a, b) => a.at - b.at).map((h) => h.id))];
}
