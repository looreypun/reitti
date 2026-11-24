/**
 * Compact place factory used by the catalogue files.
 *
 * @param {string} city      destination id
 * @param {string} id        unique place id (kebab-case)
 * @param {string} name      display name
 * @param {string|null} wiki English Wikipedia page title (used for image + coordinate verification)
 * @param {number} lat
 * @param {number} lon
 * @param {'free'|'budget'|'mid'|'high'} price
 * @param {number} cost      estimated cost per adult in EUR
 * @param {number} pop       popularity score 0-100
 * @param {string[]} tags
 * @param {number} dur       typical visit duration in minutes
 * @param {'Morning'|'Afternoon'|'Evening'|'Any time'|'Morning to Afternoon'} best
 * @param {string} summary
 * @param {string} tip       practical visitor tip
 * @param {{months?: number[], access?: 'ferry'|'car'}} [opts]
 */
export const p = (city, id, name, wiki, lat, lon, price, cost, pop, tags, dur, best, summary, tip, opts = {}) => ({
  city,
  id,
  name,
  wiki,
  lat,
  lon,
  price,
  cost,
  pop,
  tags,
  dur,
  best,
  summary,
  tip,
  months: opts.months ?? null,
  access: opts.access ?? null,
});

export const SUMMER = [6, 7, 8];
export const WARM_SEASON = [5, 6, 7, 8, 9];
export const WINTER = [12, 1, 2, 3];
export const SKI_SEASON = [11, 12, 1, 2, 3, 4];
export const AURORA_SEASON = [9, 10, 11, 12, 1, 2, 3];
