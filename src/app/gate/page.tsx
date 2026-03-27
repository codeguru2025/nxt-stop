import GateClient from '@/components/gate/GateClient'

export const metadata = { title: 'Gate Scanner | NXT STOP' }

export default function GatePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <GateClient />
    </div>
  )
}
