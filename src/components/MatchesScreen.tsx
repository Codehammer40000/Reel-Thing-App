import type { MatchRecord, Title } from '../types'

type Props = {
  matches: MatchRecord[]
  titlesById: Map<string, Title>
}

export function MatchesScreen({ matches, titlesById }: Props) {
  if (matches.length === 0) {
    return (
      <section className="screen empty-deck">
        <h2>No matches yet</h2>
        <p className="hero-sub" style={{ textAlign: 'center' }}>
          Keep swiping. When you both yup the same title — or someone hits You Gotta See It —
          it lands here.
        </p>
      </section>
    )
  }

  return (
    <section className="screen">
      <p className="deck-status" style={{ textAlign: 'left', marginTop: 4 }}>
        {matches.length} match{matches.length === 1 ? '' : 'es'}
      </p>
      <div className="matches-list">
        {matches.map((match) => {
          const title = titlesById.get(match.titleId)
          if (!title) return null
          return (
            <a
              key={match.titleId}
              className="match-row"
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
              <span className="match-badge">IMDb</span>
            </a>
          )
        })}
      </div>
    </section>
  )
}
