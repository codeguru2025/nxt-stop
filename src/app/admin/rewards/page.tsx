import { redirect } from 'next/navigation'
import AdminRewardsClient from '@/components/admin/AdminRewardsClient'
import { FEATURES } from '@/lib/features'

export const metadata = { title: 'Rewards | Admin' }

export default function AdminRewardsPage() {
  if (!FEATURES.points) redirect('/admin')
  return <AdminRewardsClient />
}
