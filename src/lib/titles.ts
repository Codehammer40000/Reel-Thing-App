import type { FilterId, Title } from '../types'

/** Movie / short / TV movie / film — not series formats. */
export function isMovieMedia(type: string): boolean {
  const t = type.toLowerCase()
  if (/series|mini\s*series|limited\s*series/.test(t)) return false
  return /movie|short|film|video|tv\s*movie/.test(t)
}

/** Series / mini / limited / specials / other episodic TV. */
export function isTvMedia(type: string): boolean {
  const t = type.toLowerCase()
  if (isMovieMedia(type)) return false
  return /tv|series|mini|limited|special|episode|podcast/.test(t)
}

/**
 * Current-year or upcoming releases.
 * Parses years from strings like "2026", "2026–", "2013–2023", "Releases Aug 7, 2026".
 */
export function isNewRelease(year: string, now = new Date()): boolean {
  const years = [...year.matchAll(/\d{4}/g)].map((m) => Number(m[0]))
  if (years.length === 0) return false
  const currentYear = now.getFullYear()
  return years.some((y) => y >= currentYear)
}

export function filterTitles(titles: Title[], filter: FilterId): Title[] {
  switch (filter) {
    case 'new':
      return titles.filter((t) => isNewRelease(t.year))
    case 'movies':
      return titles.filter((t) => isMovieMedia(t.type))
    case 'tv':
      return titles.filter((t) => isTvMedia(t.type))
    case 'anime':
      return titles.filter((t) => t.lists.includes('anime'))
    case 'romComs':
      return titles.filter((t) => t.lists.includes('romComs'))
    case 'all':
    default:
      return titles
  }
}

/** Fixed left→right order for the category carousel. */
export const FILTER_OPTIONS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New!' },
  { id: 'movies', label: 'Movies' },
  { id: 'tv', label: 'TV' },
  { id: 'anime', label: 'Anime' },
  { id: 'romComs', label: 'Rom-Coms' },
]
