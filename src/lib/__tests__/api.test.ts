import { describe, it, expect } from 'vitest'
import { ok, error, unauthorized, forbidden, notFound, serverError } from '../api'

describe('API response helpers', () => {
  it('ok() returns 200 with success:true', async () => {
    const res = ok({ foo: 'bar' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.foo).toBe('bar')
  })

  it('ok() accepts custom status', async () => {
    const res = ok({ id: '1' }, 201)
    expect(res.status).toBe(201)
  })

  it('error() returns 400 by default', async () => {
    const res = error('bad input')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('bad input')
  })

  it('error() accepts custom status', async () => {
    const res = error('conflict', 409)
    expect(res.status).toBe(409)
  })

  it('unauthorized() returns 401', () => {
    expect(unauthorized().status).toBe(401)
  })

  it('forbidden() returns 403', () => {
    expect(forbidden().status).toBe(403)
  })

  it('notFound() returns 404 with entity name', async () => {
    const res = notFound('Event')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Event not found')
  })

  it('serverError() returns 500', () => {
    const res = serverError(new Error('test'))
    expect(res.status).toBe(500)
  })
})
