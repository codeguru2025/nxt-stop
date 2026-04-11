import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'
import next from 'next'
import { jwtVerify } from 'jose'
import { parse as parseCookie } from 'cookie'

const port = parseInt(process.env.PORT ?? '3000', 10)
const dev = process.env.NODE_ENV !== 'production'

const app = next({ dev })
const handle = app.getRequestHandler()

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET)
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res))

  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || (dev ? 'http://localhost:3000' : undefined)

  const io = new SocketServer(httpServer, {
    cors: {
      origin: allowedOrigin || false,
      credentials: true,
    },
  })

  // Redis adapter for multi-instance pub/sub
  const redisUrl = process.env.REDIS_URL
  if (redisUrl) {
    const tlsOpts = redisUrl.startsWith('rediss://') ? { tls: {} } : {}
    const pubClient = new Redis(redisUrl, tlsOpts)
    const subClient = pubClient.duplicate()

    Promise.all([
      new Promise<void>((res) => pubClient.once('ready', res)),
      new Promise<void>((res) => subClient.once('ready', res)),
    ]).then(() => {
      io.adapter(createAdapter(pubClient, subClient))
      console.log('[socket.io] Redis adapter connected')
    }).catch((err) => {
      console.error('[socket.io] Redis adapter failed:', err.message)
    })
  } else {
    console.warn('[socket.io] REDIS_URL not set — running without Redis adapter (single-instance only)')
  }

  // Authenticate Socket.IO connections via session cookie
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie ?? '')
      const token = cookies['nxt-session']
      if (!token) return next(new Error('Authentication required'))

      const { payload } = await jwtVerify(token, getJwtSecret())
      ;(socket as any).user = { id: payload.sub, role: payload.role }
      next()
    } catch {
      next(new Error('Authentication required'))
    }
  })

  io.on('connection', (socket) => {
    const user = (socket as any).user as { id: string; role: string } | undefined

    socket.on('gate:join', (eventId: string) => {
      if (!user || !['admin', 'gate_staff'].includes(user.role)) return
      socket.join(`gate:${eventId}`)
    })
    socket.on('gate:leave', (eventId: string) => {
      socket.leave(`gate:${eventId}`)
    })
    socket.on('admin:join', () => {
      if (!user || user.role !== 'admin') return
      socket.join('admin:scans')
    })
  })

  ;(global as any).__io = io

  httpServer.listen(port, () => {
    console.log(`> NXT STOP ready on http://localhost:${port} [${dev ? 'dev' : 'production'}]`)
  })
}).catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
