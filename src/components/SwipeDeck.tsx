import { useRef, useState, type HTMLAttributes } from 'react'
import { useDrag } from '@use-gesture/react'
import type { SwipeDecision, Title } from '../types'
import { MediaCard } from './MediaCard'

type Props = {
  current: Title
  next?: Title
  disabled?: boolean
  onDecision: (decision: SwipeDecision) => void
}

const THRESHOLD = 120

export function SwipeDeck({ current, next, disabled, onDecision }: Props) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [flying, setFlying] = useState<null | { x: number; y: number; rot: number }>(null)
  const locking = useRef(false)

  const commit = (decision: SwipeDecision) => {
    if (locking.current || disabled) return
    locking.current = true
    const dir = decision === 'nope' ? -1 : 1
    setFlying({ x: dir * (window.innerWidth + 80), y: 40, rot: dir * 28 })
    window.setTimeout(() => {
      onDecision(decision)
      setOffset({ x: 0, y: 0 })
      setFlying(null)
      locking.current = false
    }, 280)
  }

  const bind = useDrag(
    ({ down, movement: [mx, my], last }) => {
      if (disabled || locking.current || flying) return
      if (down) {
        setOffset({ x: mx, y: my * 0.35 })
        return
      }
      if (last) {
        if (mx > THRESHOLD) {
          commit('yup')
          return
        }
        if (mx < -THRESHOLD) {
          commit('nope')
          return
        }
        setOffset({ x: 0, y: 0 })
      }
    },
    { filterTaps: true, axis: 'x' },
  )

  const x = flying?.x ?? offset.x
  const y = flying?.y ?? offset.y
  const rot = flying?.rot ?? x * 0.05
  const yupOpacity = Math.min(1, Math.max(0, x / THRESHOLD))
  const nopeOpacity = Math.min(1, Math.max(0, -x / THRESHOLD))

  return (
    <>
      <div className="card-stage">
        {next ? <MediaCard key={next.id} title={next} className="next" /> : null}
        <MediaCard
          key={current.id}
          title={current}
          className="current"
          yupOpacity={yupOpacity}
          nopeOpacity={nopeOpacity}
          style={{
            transform: `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg)`,
            transition: flying || (!x && !y) ? 'transform 0.28s ease' : undefined,
          }}
          dragHandlers={bind() as HTMLAttributes<HTMLDivElement>}
        />
      </div>

      <div className="controls">
        <button
          type="button"
          className="action-btn nope"
          disabled={disabled}
          onClick={() => commit('nope')}
        >
          Nope
        </button>
        <button
          type="button"
          className="action-btn yup"
          disabled={disabled}
          onClick={() => commit('yup')}
        >
          Yup
        </button>
        <button
          type="button"
          className="gotta-btn"
          disabled={disabled}
          onClick={() => commit('gottaSeeIt')}
        >
          You Gotta See It
        </button>
      </div>
    </>
  )
}
