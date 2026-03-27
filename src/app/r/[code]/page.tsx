import { redirect } from 'next/navigation'

// Referral link redirect — /r/CODE → /events?ref=CODE
export default async function ReferralRedirect({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  redirect(`/events?ref=${code}`)
}
