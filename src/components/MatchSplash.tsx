import type { MatchRecord, Title } from '../types'

type Props = {
  title: Title
  match: MatchRecord
  onClose: () => void
}

export function MatchSplash({ title, match, onClose }: Props) {
  const subtitle =
    match.reason === 'gottaSeeIt'
      ? match.from
        ? `${match.from} says you gotta see it`
        : 'Someone says you gotta see it'
      : 'You both want to watch this'

  return (
    <div className="splash-backdrop" role="dialog" aria-modal="true" aria-label="It's a match">
      <div className="splash-card">
        <div className="splash-burst" aria-hidden />
        <p className="splash-kicker">It&apos;s a Match</p>
        <img src={title.posterUrl || title.thumbnailUrl} alt="" />
        <h3>{title.title}</h3>
        <p>{subtitle}</p>
        <button type="button" className="primary-btn" onClick={onClose}>
          Keep Swiping
        </button>
      </div>
    </div>
  )
}
