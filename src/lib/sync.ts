import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { auth, db, isFirebaseConfigured } from './firebase'
import type { MatchRecord, SwipeDecision, SwipeRecord, UserProfile } from '../types'

const NAME_RE = /^[A-Za-z0-9]{3,20}$/

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

export function coupleIdFor(nameA: string, nameB: string): string {
  return [nameA.toLowerCase(), nameB.toLowerCase()].sort().join('_')
}

export async function ensureAnonymousAuth(): Promise<string> {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase is not configured. Add your keys to .env')
  }
  if (auth.currentUser) return auth.currentUser.uid
  const cred = await signInAnonymously(auth)
  return cred.user.uid
}

export function watchAuth(cb: (uid: string | null) => void): Unsubscribe {
  if (!auth) {
    cb(null)
    return () => undefined
  }
  return onAuthStateChanged(auth, (user) => cb(user?.uid ?? null))
}

export async function claimDisplayName(displayName: string): Promise<UserProfile> {
  if (!db || !auth) throw new Error('Firebase is not configured')
  const error = validateDisplayName(displayName)
  if (error) throw new Error(error)

  const uid = await ensureAnonymousAuth()
  const name = normalizeDisplayName(displayName)
  const key = name.toLowerCase()
  const ref = doc(db, 'users', key)

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (snap.exists()) {
      const data = snap.data() as UserProfile
      if (data.uid !== uid) {
        throw new Error('That display name is already taken.')
      }
      return
    }
    tx.set(ref, {
      displayName: name,
      uid,
      createdAt: Date.now(),
    } satisfies UserProfile)
  })

  const snap = await getDoc(ref)
  return snap.data() as UserProfile
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
    throw new Error(`No user found named "${them}". Ask them to claim that name first.`)
  }

  const uid = await ensureAnonymousAuth()
  const myRef = doc(db, 'users', me.toLowerCase())
  const mySnap = await getDoc(myRef)
  if (!mySnap.exists() || (mySnap.data() as UserProfile).uid !== uid) {
    throw new Error('Your session does not match this display name. Reclaim your name.')
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

  // yup — check partner
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
