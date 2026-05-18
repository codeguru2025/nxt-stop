import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE = 'https://nxt-stop-lp27d.ondigitalocean.app'

export type ScanResult = {
  result: 'valid' | 'already_used' | 'invalid' | 'early_scan'
  message: string
  ticket?: {
    number: string
    holder: string
    phone?: string
    type: string
    color?: string
    event?: string
    venue?: string
  }
  usedAt?: string
}

function extractCookie(setCookieHeader: string | null, name: string): string | null {
  if (!setCookieHeader) return null
  // Multiple Set-Cookie headers are sometimes joined with commas
  const parts = setCookieHeader.split(/,(?=\s*\w+=)/)
  for (const part of parts) {
    const match = part.trim().match(new RegExp(`(?:^|;\\s*)${name}=([^;\\s]+)`))
    if (match) return match[1]
  }
  return null
}

export async function checkSession(): Promise<{ loggedIn: boolean }> {
  try {
    const session = await AsyncStorage.getItem('nxt_session')
    if (!session) return { loggedIn: false }

    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { Cookie: `nxt-session=${session}` },
    })
    const data = await res.json()
    if (data.success && ['admin', 'gate_staff'].includes(data.data?.role)) {
      return { loggedIn: true }
    }
    await AsyncStorage.removeItem('nxt_session')
    return { loggedIn: false }
  } catch {
    return { loggedIn: false }
  }
}

export async function login(
  phone: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.trim(), password }),
      credentials: 'include',
    })

    const setCookieHeader = res.headers.get('set-cookie')
    const sessionToken = extractCookie(setCookieHeader, 'nxt-session')
    if (sessionToken) {
      await AsyncStorage.setItem('nxt_session', sessionToken)
    }

    const data = await res.json()
    if (!data.success) return { ok: false, error: data.error ?? 'Invalid credentials' }

    const role = data.data?.user?.role
    if (!['admin', 'gate_staff'].includes(role)) {
      return { ok: false, error: 'Not authorised as gate staff or admin' }
    }

    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Network error — check connection' }
  }
}

export async function scanTicket(qrCode: string): Promise<ScanResult> {
  const session = await AsyncStorage.getItem('nxt_session')

  const res = await fetch(`${BASE}/api/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Cookie: `nxt-session=${session}` } : {}),
    },
    body: JSON.stringify({ qrCode }),
    credentials: 'include',
  })

  if (res.status === 401 || res.status === 403) {
    await AsyncStorage.removeItem('nxt_session')
    throw new Error('SESSION_EXPIRED')
  }

  const data = await res.json()
  if (!data.success) throw new Error(data.error ?? 'Scan failed')
  return data.data as ScanResult
}

export async function getScanStats(): Promise<{ scanned: number; valid: number; invalid: number; early: number; used: number }> {
  try {
    const session = await AsyncStorage.getItem('nxt_session')
    const res = await fetch(`${BASE}/api/scan/stats`, {
      headers: session ? { Cookie: `nxt-session=${session}` } : {},
    })
    const data = await res.json()
    if (data.success) return data.data
  } catch {}
  return { scanned: 0, valid: 0, invalid: 0, early: 0, used: 0 }
}

export async function logout(): Promise<void> {
  await AsyncStorage.removeItem('nxt_session')
}
