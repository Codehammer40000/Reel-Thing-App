import { useState, type FormEvent } from 'react'
import { linkPartner, validateDisplayName } from '../lib/sync'

type Props = {
  myName: string
  currentPartner: string
  onChanged: (partnerName: string, coupleId: string) => void
  onClose: () => void
}

export function ChangePartnerModal({
  myName,
  currentPartner,
  onChanged,
  onClose,
}: Props) {
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
    if (partner.toLowerCase() === currentPartner.toLowerCase()) {
      setError('That’s already your current partner.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await linkPartner(myName, partner)
      onChanged(result.partner.displayName, result.coupleId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change partner.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="splash-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Change partner"
      onClick={onClose}
    >
      <div
        className="splash-card change-partner-card"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="splash-kicker" style={{ fontSize: '2rem' }}>
          Change Partner?
        </p>
        <p>
          You&apos;re currently synced with{' '}
          <strong style={{ color: 'var(--amber)' }}>{currentPartner}</strong>. Enter a new
          display name to sync with instead.
        </p>

        <form className="form-card" onSubmit={submit}>
          <label className="field-label" htmlFor="newPartnerName">
            New partner display name
          </label>
          <input
            id="newPartnerName"
            className="text-input"
            value={partner}
            onChange={(e) => setPartner(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
            placeholder="Their exact name"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={20}
            autoFocus
          />
          {error ? <p className="error-text">{error}</p> : null}
          <button
            className="primary-btn"
            type="submit"
            disabled={busy || partner.length < 3}
          >
            {busy ? 'Updating…' : 'Sync with new partner'}
          </button>
          <button type="button" className="ghost-btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </form>
      </div>
    </div>
  )
}
