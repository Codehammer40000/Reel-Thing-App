import { useEffect, useMemo, useRef, useState } from 'react'
import { WelcomeScreen } from './components/WelcomeScreen'
import { LinkPartnerScreen } from './components/LinkPartnerScreen'
import { MatchesScreen } from './components/MatchesScreen'
import { MatchSplash } from './components/MatchSplash'
import { SwipeDeck } from './components/SwipeDeck'
import { isFirebaseConfigured } from './lib/firebase'
import {
  clearSession,
  clearUnreadMatchIds,
  loadSession,
  loadUnreadMatchIds,
  saveSession,
  saveUnreadMatchIds,
} from './lib/session'
import {
  ensureAnonymousAuth,
  getMySwipedIds,
  recordSwipe,
  watchMatches,
  watchUser,
} from './lib/sync'
import { FILTER_OPTIONS, filterTitles } from './lib/titles'
import type {
  AppScreen,
  FilterId,
  MatchRecord,
  SwipeDecision,
  Title,
} from './types'

export default function App() {
  const [titles, setTitles] = useState<Title[]>([])
  const [loadingTitles, setLoadingTitles] = useState(true)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [partnerName, setPartnerName] = useState<string | null>(null)
  const [coupleId, setCoupleId] = useState<string | null>(null)
  const [screen, setScreen] = useState<AppScreen>('welcome')
  const [filter, setFilter] = useState<FilterId>('all')
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set())
  const [matches, setMatches] = useState<MatchRecord[]>([])
  const [splash, setSplash] = useState<{ title: Title; match: MatchRecord } | null>(
    null,
  )
  const [, setKnownMatchIds] = useState<Set<string>>(new Set())
  const [unreadMatchIds, setUnreadMatchIds] = useState<Set<string>>(new Set())
  const matchesHydrated = useRef(false)
  const selfMatchedIds = useRef(new Set<string>())
  const [busySwipe, setBusySwipe] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const titlesById = useMemo(() => new Map(titles.map((t) => [t.id, t])), [titles])
  const unreadCount = unreadMatchIds.size

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}titles.json`)
        const data = (await res.json()) as Title[]
        if (!cancelled) setTitles(data)
      } catch {
        if (!cancelled) setError('Could not load titles. Run npm run build:titles.')
      } finally {
        if (!cancelled) setLoadingTitles(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const session = loadSession()
    if (!session?.displayName) return
    setDisplayName(session.displayName)
    setPartnerName(session.partnerName ?? null)
    setCoupleId(session.coupleId ?? null)
    setScreen(session.coupleId ? 'deck' : 'link')
    if (session.coupleId) {
      setUnreadMatchIds(loadUnreadMatchIds(session.displayName, session.coupleId))
    }
    if (isFirebaseConfigured) {
      ensureAnonymousAuth().catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    if (!displayName || !isFirebaseConfigured) return
    return watchUser(displayName, (user) => {
      if (!user) return
      if (user.partnerName && user.coupleId) {
        setPartnerName(user.partnerName)
        setCoupleId(user.coupleId)
        saveSession({
          displayName: user.displayName,
          partnerName: user.partnerName,
          coupleId: user.coupleId,
        })
        setUnreadMatchIds(loadUnreadMatchIds(user.displayName, user.coupleId))
        setScreen((s) => (s === 'link' || s === 'welcome' ? 'deck' : s))
      }
    })
  }, [displayName])

  useEffect(() => {
    if (!coupleId || !displayName) return
    matchesHydrated.current = false
    return watchMatches(coupleId, (incoming) => {
      setMatches(incoming)
      setKnownMatchIds((prev) => {
        const next = new Set(prev)
        const brandNew: MatchRecord[] = []

        for (const m of incoming) {
          if (!next.has(m.titleId)) {
            brandNew.push(m)
            next.add(m.titleId)
          }
        }

        if (!matchesHydrated.current) {
          matchesHydrated.current = true
          return next
        }

        if (brandNew.length > 0) {
          const partnerNew = brandNew.filter(
            (m) => !selfMatchedIds.current.has(m.titleId),
          )
          if (partnerNew.length > 0) {
            setUnreadMatchIds((prevUnread) => {
              const unread = new Set(prevUnread)
              for (const m of partnerNew) unread.add(m.titleId)
              saveUnreadMatchIds(displayName, coupleId, unread)
              return unread
            })
          }

          for (const m of brandNew) {
            const title = titlesById.get(m.titleId)
            if (
              title &&
              m.from &&
              m.from.toLowerCase() !== displayName.toLowerCase()
            ) {
              setSplash({ title, match: m })
            }
          }
        }

        return next
      })
    })
  }, [coupleId, titlesById, displayName])

  useEffect(() => {
    if (!coupleId || !displayName) return
    getMySwipedIds(coupleId, displayName)
      .then(setSwipedIds)
      .catch(() => undefined)
  }, [coupleId, displayName])

  const deck = useMemo(() => {
    return filterTitles(titles, filter).filter((t) => !swipedIds.has(t.id))
  }, [titles, filter, swipedIds])

  const current = deck[0]
  const next = deck[1]

  const openMatches = () => {
    setScreen('matches')
    if (displayName && coupleId) {
      setUnreadMatchIds(new Set())
      clearUnreadMatchIds(displayName, coupleId)
    }
  }

  const handleClaimed = (name: string) => {
    setDisplayName(name)
    saveSession({ displayName: name })
    setScreen('link')
  }

  const handleLinked = (partner: string, id: string) => {
    setPartnerName(partner)
    setCoupleId(id)
    if (displayName) {
      saveSession({ displayName, partnerName: partner, coupleId: id })
      setUnreadMatchIds(loadUnreadMatchIds(displayName, id))
    }
    setScreen('deck')
  }

  const handleDecision = async (decision: SwipeDecision) => {
    if (!current) return
    const title = current
    setSwipedIds((prev) => new Set(prev).add(title.id))

    if (!coupleId || !displayName || !isFirebaseConfigured) return

    setBusySwipe(true)
    setError(null)
    // Mark before the write so a realtime snapshot can't badge your own match
    if (decision === 'yup' || decision === 'gottaSeeIt') {
      selfMatchedIds.current.add(title.id)
    }
    try {
      const result = await recordSwipe(coupleId, displayName, title.id, decision)
      if (result.matched && result.match) {
        setKnownMatchIds((prev) => new Set(prev).add(title.id))
        setSplash({ title, match: result.match })
      } else if (decision === 'yup' || decision === 'gottaSeeIt') {
        selfMatchedIds.current.delete(title.id)
      }
    } catch (err) {
      if (decision === 'yup' || decision === 'gottaSeeIt') {
        selfMatchedIds.current.delete(title.id)
      }
      setError(err instanceof Error ? err.message : 'Failed to save swipe.')
    } finally {
      setBusySwipe(false)
    }
  }

  const resetLocal = () => {
    if (displayName && coupleId) clearUnreadMatchIds(displayName, coupleId)
    clearSession()
    setDisplayName(null)
    setPartnerName(null)
    setCoupleId(null)
    setMatches([])
    setSwipedIds(new Set())
    setKnownMatchIds(new Set())
    setUnreadMatchIds(new Set())
    selfMatchedIds.current = new Set()
    setScreen('welcome')
  }

  return (
    <div className="app-shell">
      {screen !== 'welcome' ? (
        <header className="topbar">
          <h1 className="brand-mark">
            The Reel <span>Thing</span>
          </h1>
          <div className="topbar-actions">
            {coupleId ? (
              <>
                <button
                  type="button"
                  className={`ghost-btn ${screen === 'deck' ? 'active' : ''}`}
                  onClick={() => setScreen('deck')}
                >
                  Deck
                </button>
                <button
                  type="button"
                  className={`ghost-btn ${screen === 'matches' ? 'active' : ''}`}
                  onClick={openMatches}
                >
                  Matches
                  {unreadCount > 0 ? (
                    <span className="nav-badge" aria-label={`${unreadCount} new matches`}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  ) : null}
                </button>
              </>
            ) : (
              <button type="button" className="ghost-btn" onClick={() => setScreen('link')}>
                Sync
              </button>
            )}
          </div>
        </header>
      ) : null}

      {partnerName && screen !== 'welcome' ? (
        <p className="deck-status" style={{ marginTop: 0 }}>
          Synced with <span className="partner-pill">{partnerName}</span>
        </p>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      {screen === 'welcome' ? <WelcomeScreen onClaimed={handleClaimed} /> : null}

      {screen === 'link' && displayName ? (
        <LinkPartnerScreen
          myName={displayName}
          onLinked={handleLinked}
          onSkip={() => setScreen('deck')}
        />
      ) : null}

      {screen === 'deck' ? (
        <section className="screen deck-screen">
          <div className="filters">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`filter-chip ${filter === opt.id ? 'active' : ''}`}
                onClick={() => setFilter(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {loadingTitles ? (
            <div className="empty-deck">
              <h2>Loading</h2>
              <p className="hero-sub">Pulling in the reel…</p>
            </div>
          ) : !current ? (
            <div className="empty-deck">
              <h2>End of reel</h2>
              <p className="hero-sub" style={{ textAlign: 'center' }}>
                You&apos;ve swiped everything in this filter. Check your matches or try another
                list.
              </p>
              <button type="button" className="primary-btn" onClick={openMatches}>
                View Matches
              </button>
            </div>
          ) : (
            <>
              <SwipeDeck
                current={current}
                next={next}
                disabled={busySwipe}
                onDecision={handleDecision}
              />
              <p className="deck-status">
                {deck.length} left in this list
                {!coupleId ? " · browsing solo (swipes won't sync)" : ''}
              </p>
            </>
          )}
        </section>
      ) : null}

      {screen === 'matches' ? (
        <MatchesScreen matches={matches} titlesById={titlesById} />
      ) : null}

      {splash ? (
        <MatchSplash
          title={splash.title}
          match={splash.match}
          onClose={() => setSplash(null)}
        />
      ) : null}

      {displayName && screen !== 'welcome' ? (
        <button
          type="button"
          className="ghost-btn"
          style={{ alignSelf: 'center', marginTop: 8 }}
          onClick={resetLocal}
        >
          Switch account
        </button>
      ) : null}
    </div>
  )
}
