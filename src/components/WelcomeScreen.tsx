import { useState, type FormEvent } from 'react'
import { claimDisplayName, validateDisplayName } from '../lib/sync'
import { isFirebaseConfigured } from '../lib/firebase'

type Props = {
  onClaimed: (displayName: string) => void
}

export function WelcomeScreen({ onClaimed }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const validation = validateDisplayName(name)
    if (validation) {
      setError(validation)
      return
    }
    if (!isFirebaseConfigured) {
      setError('Firebase is not configured yet. Add your keys to .env (see .env.example).')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const profile = await claimDisplayName(name)
      onClaimed(profile.displayName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not claim that name.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="screen welcome">
      <h1 className="hero-brand">
        The Reel<em>Thing</em>
      </h1>
      <p className="hero-sub">
        Swipe on movies and TV with your partner. When you both say yup — it&apos;s a match.
      </p>

      {!isFirebaseConfigured ? (
        <div className="config-banner">
          Copy <code>.env.example</code> to <code>.env</code> and paste your Firebase web app
          config before claiming a name.
        </div>
      ) : null}

      <form className="form-card" onSubmit={submit}>
        <label className="field-label" htmlFor="displayName">
          Your display name
        </label>
        <input
          id="displayName"
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
          placeholder="e.g. Jon"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={20}
        />
        <p className="hint-text">Letters and numbers only · 3–20 characters · must be unique</p>
        {error ? <p className="error-text">{error}</p> : null}
        <button className="primary-btn" type="submit" disabled={busy || name.length < 3}>
          {busy ? 'Claiming…' : 'Enter The Reel Thing'}
        </button>
      </form>
    </section>
  )
}
