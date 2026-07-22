export type MediaType = 'Movie' | 'TV Series' | 'TV Mini Series' | string

export type ListTag =
  | 'top250Movies'
  | 'top250Tv'
  | 'popularMovies'
  | 'popularTv'

export type Title = {
  id: string
  title: string
  type: MediaType
  rating: number
  year: string
  blurb: string
  thumbnailUrl: string
  posterUrl: string
  imdbUrl: string
  lists: ListTag[]
  ranks: Partial<Record<ListTag, number>>
}

export type SwipeDecision = 'yup' | 'nope' | 'gottaSeeIt'

export type FilterId =
  | 'all'
  | 'movies'
  | 'tv'
  | 'top250'
  | 'popular'

export type UserProfile = {
  displayName: string
  uid: string
  partnerName?: string
  coupleId?: string
  createdAt: number
}

export type MatchRecord = {
  titleId: string
  reason: 'mutual' | 'gottaSeeIt'
  from?: string
  at: number
}

export type SwipeRecord = {
  titleId: string
  userName: string
  decision: SwipeDecision
  at: number
}

export type AppScreen = 'welcome' | 'link' | 'deck' | 'matches'
