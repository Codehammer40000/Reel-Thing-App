import { useState, type FormEvent } from 'react'
import {
  registerAccount,
  signInAccount,
  validateDisplayName,
  validatePassword,
} from '../lib/sync'
import { isFirebaseConfigured } from '../lib/firebase'

type Props = {
  onAuthed: (displayName: string, profile: { partnerName?: string; coupleId?: string }) => void
}

type Mode = 'create' | 'signin'

export function WelcomeScreen({ onAuthed }: Props) {
  const [mode, setMode] = useState<Mode>('create')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const nameErr = validateDisplayName(name)
    if (nameErr) {
      setError(nameErr)
      return
    }
    const passErr = validatePassword(password)
    if (passErr) {
      setError(passErr)
      return
    }
    if (mode === 'create' && password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (!isFirebaseConfigured) {
      setError('Firebase is not configured yet. Add your keys to .env (see .env.example).')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const profile =
        mode === 'create'
          ? await registerAccount(name, password)
          : await signInAccount(name, password)
      onAuthed(profile.displayName, {
        partnerName: profile.partnerName,
        coupleId: profile.coupleId,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not continue.')
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
          config before continuing.
        </div>
      ) : null}

      <div className="auth-tabs">
        <button
          type="button"
          className={`auth-tab ${mode === 'create' ? 'active' : ''}`}
          onClick={() => {
            setMode('create')
            setError(null)
          }}
        >
          Create account
        </button>
        <button
          type="button"
          className={`auth-tab ${mode === 'signin' ? 'active' : ''}`}
          onClick={() => {
            setMode('signin')
            setError(null)
          }}
        >
          Sign in
        </button>
      </div>

      <form className="form-card" onSubmit={submit}>
        <label className="field-label" htmlFor="displayName">
          Display name
        </label>
        <input
          id="displayName"
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
          placeholder="e.g. Jon"
          autoComplete="username"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={20}
        />

        <label className="field-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          className="text-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
          minLength={6}
        />

        {mode === 'create' ? (
          <>
            <label className="field-label" htmlFor="confirmPassword">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              className="text-input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              autoComplete="new-password"
              minLength={6}
            />
          </>
        ) : null}

        <p className="hint-text">
          {mode === 'create'
            ? 'Letters and numbers only for the name · password unlocks this account on any device'
            : 'Use the same display name and password on your phone or another browser'}
        </p>
        {error ? <p className="error-text">{error}</p> : null}
        <button
          className="primary-btn"
          type="submit"
          disabled={busy || name.length < 3 || password.length < 6}
        >
          {busy
            ? mode === 'create'
              ? 'Creating…'
              : 'Signing in…'
            : mode === 'create'
              ? 'Create & Enter'
              : 'Sign In'}
        </button>
      </form>
    </section>
  )
}
