import type { FilterId, Title } from '../types'

export function filterTitles(titles: Title[], filter: FilterId): Title[] {
  switch (filter) {
    case 'movies':
      return titles.filter((t) => /movie/i.test(t.type))
    case 'tv':
      return titles.filter((t) => /tv|series|mini/i.test(t.type))
    case 'top250':
      return titles.filter(
        (t) => t.lists.includes('top250Movies') || t.lists.includes('top250Tv'),
      )
    case 'popular':
      return titles.filter(
        (t) => t.lists.includes('popularMovies') || t.lists.includes('popularTv'),
      )
    default:
      return titles
  }
}

export const FILTER_OPTIONS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'movies', label: 'Movies' },
  { id: 'tv', label: 'TV' },
  { id: 'top250', label: 'Top 250' },
  { id: 'popular', label: 'Popular' },
]
