/** Parses replies into paragraphs, bullets, headings, **bold** and [[place-id]] references. */
export type Inline = { type: 'text'; text: string } | { type: 'bold'; text: string } | { type: 'place'; id: string };
export type Block = { type: 'p' | 'li' | 'h'; inlines: Inline[] };

export function stripThinking(text: string): string {
  // removes <think> blocks, including an unfinished one while streaming
  return text.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trimStart();
}

export function parseInlines(text: string, isKnownPlace: (id: string) => boolean): Inline[] {
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

/** Place ids referenced in a reply ([[id]] markers or candidate names), in order of first mention. */
export function citedPlaceIds(
  text: string,
  isKnownPlace: (id: string) => boolean,
  candidates: { id: string; name: string }[] = [],
): string[] {
  const clean = stripThinking(text);
  const hits: { id: string; at: number }[] = [];
  for (const m of clean.matchAll(/\[\[([a-z0-9-]+)\]\]/g)) if (isKnownPlace(m[1])) hits.push({ id: m[1], at: m.index ?? 0 });
  const lower = clean.toLowerCase();
  for (const c of candidates) {
    const at = lower.indexOf(c.name.toLowerCase());
    if (at >= 0) hits.push({ id: c.id, at });
  }
  return [...new Set(hits.sort((a, b) => a.at - b.at).map((h) => h.id))];
}
