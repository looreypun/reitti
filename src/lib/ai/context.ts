import type { Destination, Place, TagInfo } from '../../types';
import { MONTH_NAMES, monthOf } from '../dates';
import { formatDuration, formatEUR } from '../format';
import { parseSmartQuery } from '../smartQuery';
import { normalize } from '../text';

/** Picks the places (and city facts) relevant to a question and formats them as model context. */

export const MAX_CONTEXT_PLACES = 8;
const MIN_CITY_PLACES = 5;

export interface RetrievalInput {
  question: string;
  /** Earlier user messages, oldest first — used to carry the city over to follow-up questions. */
  previousQuestions: string[];
  destinations: Destination[];
  places: Place[];
  tagCatalog: TagInfo[];
  today: string; // YYYY-MM-DD
}

export interface Retrieval {
  places: Place[];
  destinations: Destination[];
  context: string;
}

const FILLER = new Set(
  'what where when which who how can could should would will are is was there any good nice some about with without from into than that this then them they your you our for and the tell give recommend suggest want like love need visit see go going trip travel things thing stuff place places spot spots also more less other others please help plan'.split(
    ' ',
  ),
);

function looseScore(place: Place, words: string[]): number {
  if (!words.length) return 0;
  const name = normalize(place.name);
  const tags = place.tags.map(normalize).join(' ');
  const text = normalize(`${place.summary} ${place.tip} ${place.region}`);
  let score = 0;
  for (const w of words) {
    if (name.includes(w)) score += 4;
    else if (tags.includes(w)) score += 3;
    else if (text.includes(w)) score += 1;
  }
  return score;
}

export function retrievePlaces(input: RetrievalInput): { places: Place[]; destinations: Destination[] } {
  const { destinations, places, tagCatalog } = input;
  const own = parseSmartQuery(input.question, destinations, tagCatalog);
  const previous = input.previousQuestions[input.previousQuestions.length - 1];

  // short follow-ups ("what about cheaper ones?") inherit the previous question
  const isFollowUp = !!previous && !own.city && !own.tags.length && input.question.trim().split(/\s+/).length <= 8;
  const text = isFollowUp ? `${previous} ${input.question}` : input.question;
  const parsed = isFollowUp ? parseSmartQuery(text, destinations, tagCatalog) : own;
  if (own.price.length) parsed.price = own.price; // the newest budget wins

  // keep the city from earlier in the conversation
  let city = parsed.city;
  for (let i = input.previousQuestions.length - 1; !city && i >= 0; i--) {
    city = parseSmartQuery(input.previousQuestions[i], destinations, tagCatalog).city;
  }

  const words = parsed.rest
    .split(/\s+/)
    .map(normalize)
    .filter((w) => w.length >= 3 && !FILLER.has(w));
  const wantsIndoor = /\b(rain|rainy|raining|indoor|indoors|cold|bad weather)\b/i.test(text);
  const month = monthOf(input.today);

  const pool = places.filter((p) => (!city || p.destination_id === city) && (!parsed.price.length || parsed.price.includes(p.price_range)));
  const scored = pool
    .map((p) => {
      let match = looseScore(p, words);
      match += parsed.tags.filter((t) => p.tags.includes(t)).length * 5;
      if (wantsIndoor && p.indoor) match += 4;
      let bonus = p.popularity_score / 100;
      if (parsed.days && p.recommended_days.includes(parsed.days)) bonus += 1;
      if (p.open_months.includes(month)) bonus += 1;
      return { p, match, score: match + bonus };
    })
    .sort((a, b) => b.score - a.score);

  // matches only; fall back to popular places, and top up short lists within a single city
  const matching = scored.filter((s) => s.match > 0);
  let chosen = matching.length ? matching : scored;
  if (city && matching.length && matching.length < MIN_CITY_PLACES) {
    chosen = [...matching, ...scored.filter((s) => s.match === 0).slice(0, MIN_CITY_PLACES - matching.length)];
  }
  const picked = chosen.slice(0, MAX_CONTEXT_PLACES).map((s) => s.p);

  const destIds = [...new Set([city, ...picked.map((p) => p.destination_id)].filter(Boolean) as string[])].slice(0, 3);
  return { places: picked, destinations: destIds.map((id) => destinations.find((d) => d.id === id)).filter(Boolean) as Destination[] };
}

function describeDestination(d: Destination, today: string): string {
  const m = monthOf(today);
  const c = d.climate.monthly.find((x) => x.month === m);
  const lines = [`${d.city} (${d.region})${d.description ? `: ${d.description}` : ''}`];
  const facts = [
    d.local_specialty && `local food: ${d.local_specialty}`,
    d.has_tram && 'has trams',
    d.aurora_zone && 'northern lights possible on clear dark nights (roughly Sep–Mar)',
    c && `typical ${MONTH_NAMES[m - 1]}: ${Math.round(c.avg_high_c)}°C by day, ${Math.round(c.avg_low_c)}°C at night, about ${Math.round(c.daylight_hours)} h of daylight`,
  ].filter(Boolean);
  if (facts.length) lines.push(`  ${facts.join('; ')}`);
  return lines.join('\n');
}

function describePlace(p: Place, today: string): string {
  const open = p.open_months.includes(monthOf(today));
  return [
    `[[${p.id}]] ${p.name} — ${p.city}`,
    `  Cost: ${p.estimated_cost_eur ? `${formatEUR(p.estimated_cost_eur)} per adult` : 'free'} | Visit: ${formatDuration(p.duration_mins)} | Season: ${p.season_label}${open ? '' : ' (closed this month)'} | ${p.indoor ? 'Indoor' : 'Outdoor'} | Best: ${p.best_time_of_day}`,
    `  Tags: ${p.tags.join(', ')}`,
    `  About: ${p.summary}`,
    p.tip && `  Tip: ${p.tip}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildContext(input: RetrievalInput): Retrieval {
  const { places, destinations } = retrievePlaces(input);
  const context = [
    `Today: ${input.today} (${MONTH_NAMES[monthOf(input.today) - 1]})`,
    destinations.length ? `CITIES:\n${destinations.map((d) => describeDestination(d, input.today)).join('\n')}` : '',
    places.length ? `PLACES:\n${places.map((p) => describePlace(p, input.today)).join('\n\n')}` : 'PLACES: none matched',
  ]
    .filter(Boolean)
    .join('\n\n');
  return { places, destinations, context };
}

export const SYSTEM_PROMPT = `You are the travel assistant of a trip-planning app for Finland that helps people find attractions and plan routes.

Rules:
- Answer ONLY with facts from the CONTEXT in the latest message. Never invent places, prices, opening times or distances.
- Every time you mention a place from CONTEXT, put its id in double square brackets right after the name, exactly as written in CONTEXT, e.g. "Suomenlinna Sea Fortress [[suomenlinna]]".
- Prices are estimates per adult in euros.
- If a place is closed this month, say so.
- If CONTEXT does not answer the question, say that briefly and suggest a question you can answer (a city, an interest, a budget or a trip length).
- Be concise and friendly: one short intro sentence, then at most 5 bullet points. Use "- " for bullets. No tables.`;
