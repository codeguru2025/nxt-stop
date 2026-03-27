import { prisma } from '@/lib/db'
import { ok, serverError } from '@/lib/api'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { generateQRDataURL } from '@/lib/qr'
import { slugify } from '@/lib/utils'

// POST /api/admin/seed — seeds initial data
// Requires ?secret=SEED_SECRET or header x-seed-secret matching the SEED_SECRET env var
export async function POST(req: Request) {
  const secret = process.env.SEED_SECRET
  if (!secret) return Response.json({ error: 'SEED_SECRET env var not set' }, { status: 500 })

  const url = new URL(req.url)
  const provided = url.searchParams.get('secret') ?? req.headers.get('x-seed-secret')
  if (provided !== secret) return Response.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@nxtstop.com'
    const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123'
    const gateEmail = process.env.GATE_EMAIL ?? 'gate@nxtstop.com'
    const gatePassword = process.env.GATE_PASSWORD ?? 'gate123'

    const hash = await bcrypt.hash(adminPassword, 12)

    // Admin user
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        name: 'NXT STOP Admin',
        email: adminEmail,
        passwordHash: hash,
        role: 'admin',
      },
    })

    // Gate staff
    await prisma.user.upsert({
      where: { email: gateEmail },
      update: {},
      create: {
        name: 'Gate Staff',
        email: gateEmail,
        passwordHash: await bcrypt.hash(gatePassword, 12),
        role: 'gate_staff',
      },
    })

    // Founders
    const founders = [
      { name: 'DJ Nova', role: 'Co-Founder & Creative Director', bio: "The architect behind NXT STOP's signature sound and visual identity.", order: 0 },
      { name: 'Zara Moyo', role: 'Co-Founder & CEO', bio: "Visionary entrepreneur driving NXT STOP's expansion across Southern Africa.", order: 1 },
    ]
    for (const f of founders) {
      await prisma.founder.upsert({
        where: { id: f.name.toLowerCase().replace(/\s/g, '-') },
        update: {},
        create: { id: f.name.toLowerCase().replace(/\s/g, '-'), ...f },
      })
    }

    // Points config
    await prisma.pointsConfig.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default', pointsPerSale: 10, bonusMultiplier: 1.0 },
    })

    // Rewards
    const rewardDefs = [
      { name: 'Free Drink', type: 'free_drink', pointsCost: 50, description: 'Redeem for one free drink at the event bar.' },
      { name: 'Discounted Ticket', type: 'discounted_ticket', pointsCost: 100, description: '50% off your next ticket purchase.' },
      { name: 'Free Entry', type: 'free_entry', pointsCost: 200, description: 'Free general admission to any NXT STOP event.' },
      { name: 'Bring a Friend', type: 'bring_friend', pointsCost: 300, description: 'Two-for-one entry to a selected event.' },
      { name: 'VIP Upgrade', type: 'vip_upgrade', pointsCost: 500, description: 'Upgrade your general ticket to VIP access.' },
    ]
    for (const r of rewardDefs) {
      await prisma.reward.upsert({
        where: { id: r.type },
        update: {},
        create: { id: r.type, ...r },
      })
    }

    // Event — Dlala Thukzin @ ZITF Pavilion, Bulawayo
    const eventSlug = 'nxt-stop-bulawayo-dlala-thukzin-2026'
    const event = await prisma.event.upsert({
      where: { slug: eventSlug },
      update: {},
      create: {
        name: 'NXT STOP: Dlala Thukzin Live',
        slug: eventSlug,
        description: 'NXT STOP brings the heat to Bulawayo. Dlala Thukzin takes the stage at the iconic ZITF Pavilion — one night, one vibe, zero compromises. MC Mzoe7 holds it down on the mic.',
        venue: 'ZITF Pavilion',
        address: 'Centenary Park, Bulawayo',
        date: new Date('2026-08-29T20:00:00'),
        endDate: new Date('2026-08-30T04:00:00'),
        status: 'published',
        posterImage: 'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/DLALA%20THUKZIN.jpeg',
        lineup: JSON.stringify(['Dlala Thukzin', 'Big Q', 'Corrason', 'Yugo']),
        hasVirtual: false,
        platformFee: 0.10,
        ticketTypes: {
          create: [
            { name: 'Early Bird', price: 10, capacity: 300, color: '#10B981' },
            { name: 'General', price: 15, capacity: 2000, color: '#8B5CF6' },
            { name: 'VIP', price: 35, capacity: 200, color: '#F59E0B' },
            { name: 'VVIP Table', price: 120, capacity: 30, color: '#EF4444', description: 'Private table, bottle service, and dedicated waitstaff.' },
          ],
        },
        products: {
          create: [
            { name: 'Lager', category: 'drink', price: 3, stock: 1000, lowStockAt: 100 },
            { name: 'Spirits Shot', category: 'drink', price: 5, stock: 500, lowStockAt: 50 },
            { name: 'Water 500ml', category: 'drink', price: 1, stock: 500, lowStockAt: 50 },
            { name: 'NXT STOP T-Shirt', category: 'merchandise', price: 15, stock: 150, lowStockAt: 15 },
          ],
        },
      },
      include: { ticketTypes: true },
    })

    // Partner (DJ)
    const partnerReferralCode = 'DJFIRE2025'
    const partnerUser = await prisma.user.upsert({
      where: { email: 'dj.fire@nxtstop.com' },
      update: {},
      create: {
        name: 'DJ Fire',
        email: 'dj.fire@nxtstop.com',
        passwordHash: await bcrypt.hash('dj123', 12),
        role: 'partner',
      },
    })
    await prisma.partner.upsert({
      where: { userId: partnerUser.id },
      update: {},
      create: {
        userId: partnerUser.id,
        type: 'dj',
        businessName: 'DJ Fire Entertainment',
        referralCode: partnerReferralCode,
        commissionRate: 10,
      },
    })

    return ok({
      message: 'Seed complete',
      credentials: {
        admin: { email: adminEmail, password: adminPassword },
        gate: { email: gateEmail, password: gatePassword },
        partner: { email: 'dj.fire@nxtstop.com', password: 'dj123' },
      },
    })
  } catch (e) {
    return serverError(e)
  }
}
