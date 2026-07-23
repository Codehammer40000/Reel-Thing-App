import { useMemo, useState } from 'react'
import type { MatchRecord, Title } from '../types'

type MatchTab = 'matches' | 'watched'

type Props = {
  matches: MatchRecord[]
  titlesById: Map<string, Title>
  onToggleWatched: (titleId: string, watched: boolean) => void
}

export function MatchesScreen({ matches, titlesById, onToggleWatched }: Props) {
  const [tab, setTab] = useState<MatchTab>('matches')

  const activeMatches = useMemo(
    () => matches.filter((m) => !m.watched).sort((a, b) => b.at - a.at),
    [matches],
  )
  const watchedMatches = useMemo(
    () =>
      matches
        .filter((m) => m.watched)
        .sort((a, b) => (b.watchedAt ?? b.at) - (a.watchedAt ?? a.at)),
    [matches],
  )

  const list = tab === 'matches' ? activeMatches : watchedMatches

  return (
    <section className="screen matches-screen">
      <div className="match-tabs" role="tablist" aria-label="Match lists">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'matches'}
          className={`match-tab ${tab === 'matches' ? 'active' : ''}`}
          onClick={() => setTab('matches')}
        >
          Matches{activeMatches.length ? ` (${activeMatches.length})` : ''}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'watched'}
          className={`match-tab ${tab === 'watched' ? 'active' : ''}`}
          onClick={() => setTab('watched')}
        >
          Watched{watchedMatches.length ? ` (${watchedMatches.length})` : ''}
        </button>
      </div>

      {list.length === 0 ? (
        <div className="empty-deck" style={{ paddingTop: 32 }}>
          <h2>{tab === 'matches' ? 'No matches yet' : 'Nothing watched'}</h2>
          <p className="hero-sub" style={{ textAlign: 'center' }}>
            {tab === 'matches'
              ? 'Keep swiping. When you both yup the same title — or someone hits You Gotta See It — it lands here.'
              : 'Mark something Watched from your Matches list and it’ll show up here.'}
          </p>
        </div>
      ) : (
        <div className="matches-list">
          {list.map((match) => {
            const title = titlesById.get(match.titleId)
            if (!title) return null
            const isWatched = Boolean(match.watched)
            return (
              <div key={match.titleId} className="match-row">
                <a
                  className="match-row-main"
                  href={title.imdbUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img src={title.posterUrl || title.thumbnailUrl} alt="" />
                  <div>
                    <h3>{title.title}</h3>
                    <p>
                      {title.year} · ★ {title.rating.toFixed(1)} · {title.type}
                    </p>
                    <p>
                      {match.reason === 'gottaSeeIt'
                        ? match.from
                          ? `Gotta see it — ${match.from}`
                          : 'Gotta see it'
                        : 'Mutual yup'}
                    </p>
                  </div>
                </a>
                <button
                  type="button"
                  className={`watched-btn ${isWatched ? 'filled' : ''}`}
                  aria-pressed={isWatched}
                  onClick={() => onToggleWatched(match.titleId, !isWatched)}
                >
                  Watched
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
