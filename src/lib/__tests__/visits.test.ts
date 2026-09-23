import { describe, it, expect, vi } from 'vitest'

vi.mock('../db', () => ({ prisma: {} }))
vi.mock('../env', () => ({ env: { JWT_SECRET: 'test-secret' } }))
const { isBot, deviceOf, sourceOf, hashIp } = await import('../visits')

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A146B) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36'
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36'

describe('isBot — link previews and crawlers are not clicks', () => {
  it.each([
    ['WhatsApp/2.23.20.0 A', true],
    ['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', true],
    ['TelegramBot (like TwitterBot)', true],
    ['Mozilla/5.0 (compatible; Googlebot/2.1)', true],
    ['curl/8.4.0', true],
    ['', true],
    [IPHONE, false],
    [ANDROID, false],
    [DESKTOP, false],
  ])('%s → %s', (ua, bot) => expect(isBot(ua)).toBe(bot))

  it('a person browsing inside the WhatsApp/Facebook app is NOT a bot', () => {
    expect(isBot(`${ANDROID} [FBAN/FB4A;FBAV/450.0]`)).toBe(false)
    expect(isBot(`${IPHONE} Instagram 300.0`)).toBe(false)
  })
})

describe('deviceOf', () => {
  it('phones, tablets and computers', () => {
    expect(deviceOf(IPHONE)).toBe('mobile')
    expect(deviceOf(ANDROID)).toBe('mobile')
    expect(deviceOf('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe('tablet')
    expect(deviceOf('Mozilla/5.0 (Linux; Android 13; SM-X200) Safari/537.36')).toBe('tablet')
    expect(deviceOf(DESKTOP)).toBe('desktop')
  })
})

describe('sourceOf — where the visitor came from', () => {
  const site = 'www.nxt-stop.com'
  it('reads the referring site', () => {
    expect(sourceOf('https://l.facebook.com/l.php?u=x', DESKTOP, site)).toBe('facebook')
    expect(sourceOf('https://web.whatsapp.com/', DESKTOP, site)).toBe('whatsapp')
    expect(sourceOf('https://www.google.com/', DESKTOP, site)).toBe('google')
    expect(sourceOf('https://t.co/abc', DESKTOP, site)).toBe('x (twitter)')
    expect(sourceOf('https://news.example.co.zw/story', DESKTOP, site)).toBe('news.example.co.zw')
  })
  it('in-app browsers are recognised even without a referrer', () => {
    expect(sourceOf(null, `${ANDROID} [FBAN/FB4A;FBAV/450.0]`, site)).toBe('facebook')
    expect(sourceOf(null, `${IPHONE} Instagram 300.0`, site)).toBe('instagram')
  })
  it('no referrer, or our own site, is "direct"', () => {
    expect(sourceOf(null, IPHONE, site)).toBe('direct')
    expect(sourceOf('https://www.nxt-stop.com/events', IPHONE, site)).toBe('direct')
  })
})

describe('hashIp', () => {
  it('never returns the raw IP and is stable for the same IP', () => {
    const h = hashIp('102.128.76.143')
    expect(h).not.toContain('102.128')
    expect(h).toBe(hashIp('102.128.76.143'))
    expect(h).not.toBe(hashIp('102.128.76.144'))
    expect(hashIp(null)).toBeNull()
  })
})
