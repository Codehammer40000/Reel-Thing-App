import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type AuthError,
} from 'firebase/auth'
import { auth, db, isFirebaseConfigured } from './firebase'
import type { MatchRecord, SwipeDecision, SwipeRecord, UserProfile } from '../types'

const NAME_RE = /^[A-Za-z0-9]{3,20}$/
const AUTH_EMAIL_DOMAIN = 'users.reelthing.app'

export function normalizeDisplayName(raw: string): string {
  return raw.trim()
}

export function validateDisplayName(raw: string): string | null {
  const name = normalizeDisplayName(raw)
  if (!NAME_RE.test(name)) {
    return 'Use 3–20 letters and numbers only (no spaces or symbols).'
  }
  return null
}

export function validatePassword(password: string): string | null {
  if (password.length < 6) {
    return 'Password must be at least 6 characters.'
  }
  return null
}

export function coupleIdFor(nameA: string, nameB: string): string {
  return [nameA.toLowerCase(), nameB.toLowerCase()].sort().join('_')
}

function authEmailFor(displayName: string): string {
  return `${normalizeDisplayName(displayName).toLowerCase()}@${AUTH_EMAIL_DOMAIN}`
}

function mapAuthError(err: unknown): string {
  const code = (err as AuthError)?.code
  switch (code) {
    case 'auth/email-already-in-use':
      return 'That display name is already taken. Try Sign in instead.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Display name or password is incorrect.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.'
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in Firebase yet.'
    default:
      return err instanceof Error ? err.message : 'Authentication failed.'
  }
}

export function requireAuthUid(): string {
  if (!auth?.currentUser) {
    throw new Error('You are signed out. Sign in again.')
  }
  return auth.currentUser.uid
}

export function watchAuth(cb: (uid: string | null) => void): Unsubscribe {
  if (!auth) {
    cb(null)
    return () => undefined
  }
  return onAuthStateChanged(auth, (user) => cb(user?.uid ?? null))
}

export async function signOutAccount(): Promise<void> {
  if (!auth) return
  await signOut(auth)
}

/** Create a new account (name + password) usable on any device. */
export async function registerAccount(
  displayName: string,
  password: string,
): Promise<UserProfile> {
  if (!db || !auth) throw new Error('Firebase is not configured')
  if (!isFirebaseConfigured) throw new Error('Firebase is not configured')

  const nameError = validateDisplayName(displayName)
  if (nameError) throw new Error(nameError)
  const passError = validatePassword(password)
  if (passError) throw new Error(passError)

  const name = normalizeDisplayName(displayName)
  const key = name.toLowerCase()
  const ref = doc(db, 'users', key)

  // Auth first — Firestore user reads require being signed in
  let uid: string
  try {
    const cred = await createUserWithEmailAndPassword(auth, authEmailFor(name), password)
    uid = cred.user.uid
  } catch (err) {
    throw new Error(mapAuthError(err))
  }

  try {
    const existing = await getDoc(ref)
    if (existing.exists()) {
      const data = existing.data() as UserProfile
      if (data.uid !== uid) {
        await auth.currentUser?.delete().catch(() => undefined)
        await signOut(auth).catch(() => undefined)
        throw new Error('That display name is already taken. Try Sign in instead.')
      }
      return data
    }

    await setDoc(ref, {
      displayName: name,
      uid,
      createdAt: Date.now(),
    } satisfies UserProfile)
  } catch (err) {
    if (err instanceof Error && err.message.includes('already taken')) throw err
    try {
      await auth.currentUser?.delete()
    } catch {
      /* ignore */
    }
    await signOut(auth).catch(() => undefined)
    throw err instanceof Error ? err : new Error('Could not create profile.')
  }

  const snap = await getDoc(ref)
  return snap.data() as UserProfile
}

/** Sign in to an existing account from any device. */
export async function signInAccount(
  displayName: string,
  password: string,
): Promise<UserProfile> {
  if (!db || !auth) throw new Error('Firebase is not configured')
  if (!isFirebaseConfigured) throw new Error('Firebase is not configured')

  const nameError = validateDisplayName(displayName)
  if (nameError) throw new Error(nameError)
  const passError = validatePassword(password)
  if (passError) throw new Error(passError)

  const name = normalizeDisplayName(displayName)

  try {
    await signInWithEmailAndPassword(auth, authEmailFor(name), password)
  } catch (err) {
    throw new Error(mapAuthError(err))
  }

  const profile = await getUserByName(name)
  if (!profile) {
    await signOut(auth)
    throw new Error('Account exists in Auth but no profile was found. Try creating again.')
  }
  if (profile.uid !== auth.currentUser?.uid) {
    await signOut(auth)
    throw new Error('This account is out of sync. Recreate it or pick a new name.')
  }
  return profile
}

export async function getUserByName(displayName: string): Promise<UserProfile | null> {
  if (!db) throw new Error('Firebase is not configured')
  const key = normalizeDisplayName(displayName).toLowerCase()
  const snap = await getDoc(doc(db, 'users', key))
  return snap.exists() ? (snap.data() as UserProfile) : null
}

export async function linkPartner(
  myName: string,
  partnerName: string,
): Promise<{ coupleId: string; partner: UserProfile }> {
  if (!db || !auth) throw new Error('Firebase is not configured')

  const me = normalizeDisplayName(myName)
  const them = normalizeDisplayName(partnerName)
  if (me.toLowerCase() === them.toLowerCase()) {
    throw new Error('You cannot sync with yourself.')
  }

  const partner = await getUserByName(them)
  if (!partner) {
    throw new Error(`No user found named "${them}". Ask them to create that name first.`)
  }

  const uid = requireAuthUid()
  const myRef = doc(db, 'users', me.toLowerCase())
  const mySnap = await getDoc(myRef)
  if (!mySnap.exists() || (mySnap.data() as UserProfile).uid !== uid) {
    throw new Error('Your session does not match this display name. Sign in again.')
  }

  const coupleId = coupleIdFor(me, them)
  const coupleRef = doc(db, 'couples', coupleId)
  const partnerRef = doc(db, 'users', them.toLowerCase())

  await runTransaction(db, async (tx) => {
    const coupleSnap = await tx.get(coupleRef)
    if (!coupleSnap.exists()) {
      tx.set(coupleRef, {
        members: [me, partner.displayName].sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase()),
        ),
        createdAt: Date.now(),
      })
    }

    tx.set(
      myRef,
      {
        partnerName: partner.displayName,
        coupleId,
      },
      { merge: true },
    )
    tx.set(
      partnerRef,
      {
        partnerName: me,
        coupleId,
      },
      { merge: true },
    )
  })

  return { coupleId, partner }
}

export async function recordSwipe(
  coupleId: string,
  userName: string,
  titleId: string,
  decision: SwipeDecision,
): Promise<{ matched: boolean; match?: MatchRecord }> {
  if (!db) throw new Error('Firebase is not configured')
  requireAuthUid()

  const swipeId = `${titleId}_${userName.toLowerCase()}`
  const swipeRef = doc(db, 'couples', coupleId, 'swipes', swipeId)
  const matchRef = doc(db, 'couples', coupleId, 'matches', titleId)
  const coupleRef = doc(db, 'couples', coupleId)

  const swipe: SwipeRecord = {
    titleId,
    userName,
    decision,
    at: Date.now(),
  }

  await setDoc(swipeRef, { ...swipe, serverAt: serverTimestamp() })

  if (decision === 'nope') {
    return { matched: false }
  }

  if (decision === 'gottaSeeIt') {
    const match: MatchRecord = {
      titleId,
      reason: 'gottaSeeIt',
      from: userName,
      at: Date.now(),
    }
    await setDoc(matchRef, { ...match, serverAt: serverTimestamp() }, { merge: true })
    return { matched: true, match }
  }

  const coupleSnap = await getDoc(coupleRef)
  if (!coupleSnap.exists()) return { matched: false }
  const members = (coupleSnap.data().members as string[]) ?? []
  const partnerName = members.find((m) => m.toLowerCase() !== userName.toLowerCase())
  if (!partnerName) return { matched: false }

  const partnerSwipeRef = doc(
    db,
    'couples',
    coupleId,
    'swipes',
    `${titleId}_${partnerName.toLowerCase()}`,
  )
  const partnerSwipe = await getDoc(partnerSwipeRef)
  if (!partnerSwipe.exists()) return { matched: false }

  const partnerDecision = (partnerSwipe.data() as SwipeRecord).decision
  if (partnerDecision === 'yup' || partnerDecision === 'gottaSeeIt') {
    const match: MatchRecord = {
      titleId,
      reason: partnerDecision === 'gottaSeeIt' ? 'gottaSeeIt' : 'mutual',
      at: Date.now(),
      ...(partnerDecision === 'gottaSeeIt' ? { from: partnerName } : {}),
    }
    await setDoc(matchRef, { ...match, serverAt: serverTimestamp() }, { merge: true })
    return { matched: true, match }
  }

  return { matched: false }
}

export function watchMatches(
  coupleId: string,
  cb: (matches: MatchRecord[]) => void,
): Unsubscribe {
  if (!db) {
    cb([])
    return () => undefined
  }
  const ref = collection(db, 'couples', coupleId, 'matches')
  return onSnapshot(ref, (snap) => {
    const matches = snap.docs.map((d) => d.data() as MatchRecord)
    matches.sort((a, b) => b.at - a.at)
    cb(matches)
  })
}

export async function setMatchWatched(
  coupleId: string,
  titleId: string,
  watched: boolean,
): Promise<void> {
  if (!db) throw new Error('Firebase is not configured')
  requireAuthUid()
  const matchRef = doc(db, 'couples', coupleId, 'matches', titleId)
  const snap = await getDoc(matchRef)
  if (!snap.exists()) {
    throw new Error('Match not found.')
  }
  const existing = snap.data() as MatchRecord
  await setDoc(
    matchRef,
    {
      titleId: existing.titleId,
      reason: existing.reason,
      ...(existing.from ? { from: existing.from } : {}),
      at: existing.at,
      watched,
      watchedAt: watched ? Date.now() : deleteField(),
      serverAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export function watchUser(
  displayName: string,
  cb: (user: UserProfile | null) => void,
): Unsubscribe {
  if (!db) {
    cb(null)
    return () => undefined
  }
  const ref = doc(db, 'users', displayName.toLowerCase())
  return onSnapshot(ref, (snap) => {
    cb(snap.exists() ? (snap.data() as UserProfile) : null)
  })
}

export async function getMySwipedIds(
  coupleId: string,
  userName: string,
): Promise<Set<string>> {
  if (!db) return new Set()
  const all = await getDocs(collection(db, 'couples', coupleId, 'swipes'))
  const ids = new Set<string>()
  all.forEach((d) => {
    const data = d.data() as SwipeRecord
    if (data.userName.toLowerCase() === userName.toLowerCase()) {
      ids.add(data.titleId)
    }
  })
  return ids
}
