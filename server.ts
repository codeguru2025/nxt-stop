import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'
import next from 'next'

const port = parseInt(process.env.PORT ?? '3000', 10)
const dev = process.env.NODE_ENV !== 'production'

const app = next({ dev, turbopack: dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res))

  // Socket.io — attach to the same HTTP server
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL ?? '*',
      credentials: true,
    },
  })

  // Redis adapter for multi-instance pub/sub
  const redisUrl = process.env.REDIS_URL!
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

  // Gate room: gate staff join event-specific rooms to receive live scan events
  io.on('connection', (socket) => {
    socket.on('gate:join', (eventId: string) => {
      socket.join(`gate:${eventId}`)
    })
    socket.on('gate:leave', (eventId: string) => {
      socket.leave(`gate:${eventId}`)
    })
    // Admin joins to receive all scans
    socket.on('admin:join', () => {
      socket.join('admin:scans')
    })
  })

  // Expose io globally so API routes can emit events
  ;(global as any).__io = io

  httpServer.listen(port, () => {
    console.log(`> NXT STOP ready on http://localhost:${port} [${dev ? 'dev' : 'production'}]`)
  })
})
