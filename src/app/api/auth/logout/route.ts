import { cookies } from 'next/headers'
import { ok } from '@/lib/api'

export async function POST() {
  const cookieStore = await cookies()
  cookieStore.delete('nxt-session')
  return ok({ message: 'Logged out' })
}
