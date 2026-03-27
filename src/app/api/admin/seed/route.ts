import { prisma } from '@/lib/db'
import { ok, serverError } from '@/lib/api'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { generateQRDataURL } from '@/lib/qr'
import { slugify } from '@/lib/utils'

// POST /api/admin/seed — seeds demo data (dev only)
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Not allowed in production' }, { status: 403 })
  }

  try {
    const hash = await bcrypt.hash('admin123', 12)

    // Admin user
    const admin = await prisma.user.upsert({
      where: { email: 'admin@nxtstop.com' },
      update: {},
      create: {
        name: 'NXT STOP Admin',
        email: 'admin@nxtstop.com',
        passwordHash: hash,
        role: 'admin',
      },
    })

    // Gate staff
    await prisma.user.upsert({
      where: { email: 'gate@nxtstop.com' },
      update: {},
      create: {
        name: 'Gate Staff',
        email: 'gate@nxtstop.com',
        passwordHash: await bcrypt.hash('gate123', 12),
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

    // Event
    const eventSlug = slugify('NXT STOP Harare Edition') + '-2025'
    const event = await prisma.event.upsert({
      where: { slug: eventSlug },
      update: {},
      create: {
        name: 'NXT STOP: Harare Edition',
        slug: eventSlug,
        description: 'The biggest nightlife event in Harare. Premium sound, world-class DJs, and an unforgettable atmosphere.',
        venue: 'Glamis Arena',
        address: '7 Grimble Road, Harare',
        date: new Date('2025-12-31T20:00:00'),
        endDate: new Date('2026-01-01T06:00:00'),
        status: 'published',
        lineup: JSON.stringify(['DJ Nova', 'DJ Maphorisa', 'Cassper Nyovest', 'Winky D']),
        hasVirtual: true,
        virtualPrice: 5,
        platformFee: 0.10,
        ticketTypes: {
          create: [
            { name: 'Early Bird', price: 10, capacity: 200, color: '#10B981' },
            { name: 'General', price: 15, capacity: 1000, color: '#8B5CF6' },
            { name: 'VIP', price: 30, capacity: 150, color: '#F59E0B' },
            { name: 'VVIP Table', price: 100, capacity: 20, color: '#EF4444', description: 'Includes private table, bottle service, and dedicated waitstaff.' },
          ],
        },
        products: {
          create: [
            { name: 'Heineken', category: 'drink', price: 3, stock: 500, lowStockAt: 50 },
            { name: 'Jack Daniel\'s Shot', category: 'drink', price: 5, stock: 200, lowStockAt: 20 },
            { name: 'Water 500ml', category: 'drink', price: 1, stock: 300, lowStockAt: 30 },
            { name: 'NXT STOP T-Shirt', category: 'merchandise', price: 15, stock: 100, lowStockAt: 10 },
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
        admin: { email: 'admin@nxtstop.com', password: 'admin123' },
        gate: { email: 'gate@nxtstop.com', password: 'gate123' },
        partner: { email: 'dj.fire@nxtstop.com', password: 'dj123' },
      },
    })
  } catch (e) {
    return serverError(e)
  }
}
