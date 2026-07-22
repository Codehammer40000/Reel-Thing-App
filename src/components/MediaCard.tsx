import type { CSSProperties, HTMLAttributes } from 'react'
import type { Title } from '../types'

type Props = {
  title: Title
  style?: CSSProperties
  className?: string
  yupOpacity?: number
  nopeOpacity?: number
  dragHandlers?: HTMLAttributes<HTMLDivElement>
}

export function MediaCard({
  title,
  style,
  className = '',
  yupOpacity = 0,
  nopeOpacity = 0,
  dragHandlers,
}: Props) {
  return (
    <div className={`media-card ${className}`} style={style} {...dragHandlers}>
      <img
        className="card-poster"
        src={title.posterUrl || title.thumbnailUrl}
        alt=""
        draggable={false}
        loading="lazy"
      />
      <div className="swipe-stamp yup" style={{ opacity: yupOpacity }}>
        YUP
      </div>
      <div className="swipe-stamp nope" style={{ opacity: nopeOpacity }}>
        NOPE
      </div>
      <div className="card-scrim">
        <div className="card-meta">
          <span>{title.type}</span>
          <span>·</span>
          <span>{title.year}</span>
          <span className="rating-pill">★ {title.rating.toFixed(1)}</span>
        </div>
        <h2 className="card-title">{title.title}</h2>
        <p className="card-blurb">{title.blurb}</p>
      </div>
    </div>
  )
}
