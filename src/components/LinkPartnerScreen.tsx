import { useState, type FormEvent } from 'react'
import { linkPartner, validateDisplayName } from '../lib/sync'

type Props = {
  myName: string
  onLinked: (partnerName: string, coupleId: string) => void
  onSkip?: () => void
}

export function LinkPartnerScreen({ myName, onLinked, onSkip }: Props) {
  const [partner, setPartner] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const validation = validateDisplayName(partner)
    if (validation) {
      setError(validation)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await linkPartner(myName, partner)
      onLinked(result.partner.displayName, result.coupleId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link partner.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="screen welcome">
      <h1 className="hero-brand" style={{ fontSize: 'clamp(2.6rem, 12vw, 3.6rem)' }}>
        Sync<em>Up</em>
      </h1>
      <p className="hero-sub">
        You&apos;re in as <strong style={{ color: 'var(--amber)' }}>{myName}</strong>. Type your
        partner&apos;s display name to start matching.
      </p>

      <form className="form-card" onSubmit={submit}>
        <label className="field-label" htmlFor="partnerName">
          Partner display name
        </label>
        <input
          id="partnerName"
          className="text-input"
          value={partner}
          onChange={(e) => setPartner(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
          placeholder="Their exact name"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={20}
        />
        {error ? <p className="error-text">{error}</p> : null}
        <button className="primary-btn" type="submit" disabled={busy || partner.length < 3}>
          {busy ? 'Linking…' : 'Link Partner'}
        </button>
        {onSkip ? (
          <button type="button" className="ghost-btn" onClick={onSkip}>
            Browse without syncing
          </button>
        ) : null}
      </form>
    </section>
  )
}
