import { useEffect, useRef, useState, type HTMLAttributes } from 'react'
import { useDrag } from '@use-gesture/react'
import type { SwipeDecision, Title } from '../types'
import { MediaCard } from './MediaCard'

type Props = {
  current: Title
  next?: Title
  shaking?: boolean
  onDecision: (decision: SwipeDecision) => void
  onShake?: () => void
}

const THRESHOLD = 120
const FLY_MS = 280

export function SwipeDeck({
  current,
  next,
  shaking,
  onDecision,
  onShake,
}: Props) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [flying, setFlying] = useState<null | { x: number; y: number; rot: number }>(
    null,
  )
  const locking = useRef(false)
  const flyTimer = useRef<number | null>(null)
  const flyingRef = useRef(false)

  const clearFlyTimer = () => {
    if (flyTimer.current != null) {
      window.clearTimeout(flyTimer.current)
      flyTimer.current = null
    }
  }

  const unlock = () => {
    locking.current = false
    flyingRef.current = false
    setFlying(null)
    setOffset({ x: 0, y: 0 })
  }

  // New top card → always clear any stuck gesture/animation state
  useEffect(() => {
    clearFlyTimer()
    unlock()
  }, [current.id])

  useEffect(() => {
    if (!shaking) return
    clearFlyTimer()
    unlock()
  }, [shaking])

  useEffect(() => {
    return () => clearFlyTimer()
  }, [])

  const commit = (decision: SwipeDecision) => {
    if (locking.current || shaking || flyingRef.current) return
    locking.current = true
    flyingRef.current = true
    const dir = decision === 'nope' ? -1 : 1
    setFlying({ x: dir * (window.innerWidth + 80), y: 40, rot: dir * 28 })

    clearFlyTimer()
    flyTimer.current = window.setTimeout(() => {
      flyTimer.current = null
      try {
        onDecision(decision)
      } finally {
        // Unlock even if parent handler throws
        unlock()
      }
    }, FLY_MS)
  }

  const bind = useDrag(
    ({ down, movement: [mx, my], last, event }) => {
      if (locking.current || flyingRef.current || shaking) return
      if (event?.cancelable) event.preventDefault()
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
    {
      filterTaps: true,
      axis: 'x',
      preventScroll: true,
      preventDefault: true,
      eventOptions: { passive: false },
    },
  )

  const x = flying?.x ?? offset.x
  const y = flying?.y ?? offset.y
  const rot = flying?.rot ?? x * 0.05
  const yupOpacity = Math.min(1, Math.max(0, x / THRESHOLD))
  const nopeOpacity = Math.min(1, Math.max(0, -x / THRESHOLD))
  const controlsLocked = shaking || Boolean(flying)

  return (
    <>
      <div className="deck-top-bar">
        <button
          type="button"
          className="shake-btn"
          disabled={shaking || !onShake || controlsLocked}
          onClick={onShake}
        >
          Shake It Up!
        </button>
      </div>

      <div className={`card-stage ${shaking ? 'shaking' : ''}`}>
        {next ? <MediaCard key={next.id} title={next} className="next" /> : null}
        <MediaCard
          key={current.id}
          title={current}
          className="current"
          yupOpacity={shaking ? 0 : yupOpacity}
          nopeOpacity={shaking ? 0 : nopeOpacity}
          style={
            shaking
              ? undefined
              : {
                  transform: `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg)`,
                  transition: flying || (!x && !y) ? 'transform 0.28s ease' : undefined,
                }
          }
          dragHandlers={bind() as HTMLAttributes<HTMLDivElement>}
        />
      </div>

      <div className="controls">
        <button
          type="button"
          className="action-btn nope"
          disabled={shaking || controlsLocked}
          onClick={() => commit('nope')}
        >
          Nope
        </button>
        <button
          type="button"
          className="action-btn yup"
          disabled={shaking || controlsLocked}
          onClick={() => commit('yup')}
        >
          Yup
        </button>
        <button
          type="button"
          className="gotta-btn"
          disabled={shaking || controlsLocked}
          onClick={() => commit('gottaSeeIt')}
        >
          You Gotta See It
        </button>
      </div>
    </>
  )
}
