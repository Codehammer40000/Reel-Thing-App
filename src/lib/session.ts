const SESSION_KEY = 'reelThing.session'
const UNREAD_KEY_PREFIX = 'reelThing.unread.'

export type LocalSession = {
  displayName: string
  partnerName?: string
  coupleId?: string
}

export function loadSession(): LocalSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as LocalSession
  } catch {
    return null
  }
}

export function saveSession(session: LocalSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

function unreadKey(displayName: string, coupleId: string): string {
  return `${UNREAD_KEY_PREFIX}${displayName.toLowerCase()}_${coupleId}`
}

export function loadUnreadMatchIds(displayName: string, coupleId: string): Set<string> {
  try {
    const raw = localStorage.getItem(unreadKey(displayName, coupleId))
    if (!raw) return new Set()
    const ids = JSON.parse(raw) as string[]
    return new Set(Array.isArray(ids) ? ids : [])
  } catch {
    return new Set()
  }
}

export function saveUnreadMatchIds(
  displayName: string,
  coupleId: string,
  ids: Set<string>,
): void {
  localStorage.setItem(unreadKey(displayName, coupleId), JSON.stringify([...ids]))
}

export function clearUnreadMatchIds(displayName: string, coupleId: string): void {
  localStorage.removeItem(unreadKey(displayName, coupleId))
}
