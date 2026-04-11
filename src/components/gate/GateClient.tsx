'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { QrCode, Check, X, AlertTriangle, Loader2, User, Ticket, RefreshCw, Camera, CameraOff, DollarSign } from 'lucide-react'
import Link from 'next/link'
import jsQR from 'jsqr'

type ScanResult = {
  result: 'valid' | 'already_used' | 'invalid'
  message: string
  ticket?: {
    number: string
    holder: string
    phone?: string
    type: string
    event: string
  }
  usedAt?: string
}

type Stats = { scanned: number; valid: number; invalid: number }

export default function GateClient() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scanLoopRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cameraStartingRef = useRef(false)

  const [qrInput, setQrInput] = useState('')
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [stats, setStats] = useState<Stats>({ scanned: 0, valid: 0, invalid: 0 })
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (!d.success || !['admin', 'gate_staff'].includes(d.data?.role)) {
        router.push('/login')
      } else {
        setAuthed(true)
      }
    }).finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    if (authed) inputRef.current?.focus()
  }, [authed])

  // Auto-scan when QR code pasted (length threshold for UUID)
  useEffect(() => {
    if (qrInput.length >= 36) {
      handleScan(qrInput)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrInput])

  // Cleanup camera on unmount
  useEffect(() => {
    return () => { stopCamera() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleScan = async (code: string) => {
    if (!code.trim() || scanning) return
    setScanning(true)
    setResult(null)

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode: code.trim() }),
      }).then(r => r.json())

      if (res.success) {
        const data = res.data as ScanResult
        setResult(data)
        setStats(prev => ({
          scanned: prev.scanned + 1,
          valid: prev.valid + (data.result === 'valid' ? 1 : 0),
          invalid: prev.invalid + (data.result !== 'valid' ? 1 : 0),
        }))

        setTimeout(() => {
          setResult(null)
          if (streamRef.current) startScanLoop()
        }, 4000)
      } else {
        setResult({ result: 'error', message: res.error ?? 'Scan failed' } as any)
      }
    } catch {
      setResult({ result: 'error', message: 'Network error — check connection' } as any)
    } finally {
      setScanning(false)
      setQrInput('')
      if (!cameraActive) inputRef.current?.focus()
    }
  }

  const startScanLoop = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const loop = () => {
      if (!streamRef.current) return
      if (video.readyState < video.HAVE_ENOUGH_DATA || video.paused || video.ended) {
        scanLoopRef.current = requestAnimationFrame(loop)
        return
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      if (canvas.width === 0 || canvas.height === 0) {
        scanLoopRef.current = requestAnimationFrame(loop)
        return
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      })

      if (code?.data) {
        // Found a QR code — stop the loop and submit
        if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current)
        handleScan(code.data)
        return
      }

      scanLoopRef.current = requestAnimationFrame(loop)
    }

    if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current)
    scanLoopRef.current = requestAnimationFrame(loop)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startCamera = async () => {
    if (cameraStartingRef.current || cameraActive) return
    cameraStartingRef.current = true
    setCameraError(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera not supported on this browser. Try Chrome or Safari over HTTPS.')
      cameraStartingRef.current = false
      return
    }

    try {
      // Try back camera first, fall back to any available camera
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      }

      streamRef.current = stream
      const video = videoRef.current
      if (!video) { stream.getTracks().forEach(t => t.stop()); return }

      video.srcObject = stream

      await new Promise<void>((resolve) => {
        const play = () => { video.play().catch(() => {}).finally(resolve) }
        if (video.readyState >= video.HAVE_METADATA) {
          play()
        } else {
          const onReady = () => {
            video.removeEventListener('loadedmetadata', onReady)
            play()
          }
          video.addEventListener('loadedmetadata', onReady)
          setTimeout(() => { video.removeEventListener('loadedmetadata', onReady); resolve() }, 4000)
        }
      })

      setCameraActive(true)
      startScanLoop()
    } catch (err: any) {
      const msg =
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Allow camera access in your browser settings and try again.'
          : err?.name === 'NotFoundError'
          ? 'No camera found on this device.'
          : err?.name === 'NotSupportedError' || err?.name === 'InsecureOperationError'
          ? 'Camera requires a secure (HTTPS) connection.'
          : `Could not start camera: ${err?.message || 'Unknown error'}`
      setCameraError(msg)
    } finally {
      cameraStartingRef.current = false
    }
  }

  const stopCamera = () => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current)
      scanLoopRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  useEffect(() => {
    if (!cameraActive && scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current)
      scanLoopRef.current = null
    }
  }, [cameraActive])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-purple-500" />
    </div>
  )

  if (!authed) return null

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">

      {/* Header */}
      <div className="bg-[#111] border-b border-[#2a2a2a] px-4 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <img
            src="https://nxt-stop.lon1.cdn.digitaloceanspaces.com/nxt-stop%20logo%20png.png"
            alt="NXT STOP"
            className="h-7 w-auto object-contain invert"
          />
          <div className="h-4 w-px bg-[#2a2a2a]" />
          <div>
            <div className="font-bold text-white text-sm leading-none">Gate Scanner</div>
            <div className="text-xs text-gray-500 leading-none mt-0.5">Entry Validation</div>
          </div>
        </div>
        <Link
          href="/gate/activate"
          className="flex items-center gap-1.5 text-sm btn-primary px-3 py-2"
        >
          <DollarSign size={14} />
          Sell Ticket
        </Link>
      </div>

      {/* Stats bar */}
      <div className="bg-[#111] border-b border-[#2a2a2a] px-4 py-3 grid grid-cols-3 gap-3 shrink-0">
        {[
          { label: 'Scanned', value: stats.scanned, color: 'text-white' },
          { label: 'Valid',   value: stats.valid,   color: 'text-green-400' },
          { label: 'Rejected', value: stats.invalid, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="text-center">
            <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">

        {/* Camera view — always rendered so videoRef is available */}
        <div className={`w-full max-w-sm ${cameraActive ? '' : 'hidden'}`}>
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-purple-400 rounded-xl opacity-70 relative">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-purple-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-purple-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-purple-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-purple-400 rounded-br-lg" />
              </div>
            </div>
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <span className="text-xs text-purple-300 bg-black/60 px-3 py-1 rounded-full">
                {scanning ? 'Validating...' : 'Point camera at QR code'}
              </span>
            </div>
          </div>
          <button
            onClick={stopCamera}
            className="w-full mt-3 flex items-center justify-center gap-2 text-sm text-red-400 hover:text-red-300 border border-red-500/20 rounded-xl py-2.5 transition-colors"
          >
            <CameraOff size={15} /> Stop Camera
          </button>
        </div>

        {/* Scan result */}
        {result ? (
          <div className={`w-full max-w-sm border rounded-2xl p-6 text-center transition-all ${
            result.result === 'valid'       ? 'scan-valid bg-green-500/5' :
            result.result === 'already_used'? 'scan-used bg-yellow-500/5' :
            'scan-invalid bg-red-500/5'
          } card`}>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              result.result === 'valid'        ? 'bg-green-500/20' :
              result.result === 'already_used' ? 'bg-yellow-500/20' :
              'bg-red-500/20'
            }`}>
              {result.result === 'valid' ? (
                <Check size={40} className="text-green-400" />
              ) : result.result === 'already_used' ? (
                <AlertTriangle size={40} className="text-yellow-400" />
              ) : (
                <X size={40} className="text-red-400" />
              )}
            </div>

            <h2 className={`text-2xl font-black mb-1 ${
              result.result === 'valid'        ? 'text-green-400' :
              result.result === 'already_used' ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {result.result === 'valid'        ? 'ENTRY GRANTED' :
               result.result === 'already_used' ? 'ALREADY USED' :
               'INVALID TICKET'}
            </h2>

            <p className="text-gray-400 text-sm mb-4">{result.message}</p>

            {result.ticket && (
              <div className="bg-[#111] rounded-xl p-4 text-left space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User size={14} className="text-gray-500" />
                  <span className="text-white font-medium">{result.ticket.holder}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Ticket size={14} className="text-gray-500" />
                  <span className="text-gray-300">{result.ticket.type}</span>
                </div>
                <div className="text-xs text-gray-600 font-mono">{result.ticket.number}</div>
                {result.usedAt && (
                  <div className="text-xs text-yellow-500">
                    Used at: {new Date(result.usedAt).toLocaleTimeString()}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : !cameraActive ? (
          <button
            onClick={startCamera}
            className="text-center group focus:outline-none"
            aria-label="Open camera scanner"
          >
            <div className={`w-40 h-40 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center mx-auto mb-4 transition-all ${
              scanning
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-[#3a3a3a] group-hover:border-purple-500/60 group-hover:bg-purple-500/5 group-active:scale-95'
            }`}>
              {scanning ? (
                <Loader2 size={40} className="text-purple-400 animate-spin" />
              ) : (
                <>
                  <Camera size={36} className="text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs text-purple-400 font-medium">Tap to scan</span>
                </>
              )}
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Ready to Scan</h2>
            <p className="text-gray-500 text-sm">Tap the camera above or paste a ticket ID below</p>
          </button>
        ) : null}

        {/* Camera error */}
        {cameraError && (
          <div className="w-full max-w-sm bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400 text-center">
            {cameraError}
            <button
              onClick={startCamera}
              className="block mt-2 mx-auto text-purple-400 hover:text-purple-300 font-medium text-xs underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Manual input */}
        <div className="w-full max-w-sm">
          <input
            ref={inputRef}
            value={qrInput}
            onChange={e => setQrInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleScan(qrInput)}
            placeholder="Scan QR code or paste ticket ID..."
            className="text-center font-mono text-sm"
            autoFocus
            autoComplete="off"
          />
          <button
            onClick={() => handleScan(qrInput)}
            disabled={!qrInput || scanning}
            className="w-full btn-primary mt-2 flex items-center justify-center gap-2"
          >
            {scanning ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
            {scanning ? 'Validating...' : 'Validate Ticket'}
          </button>
          <button
            onClick={() => { setQrInput(''); setResult(null); if (!cameraActive) inputRef.current?.focus() }}
            className="w-full mt-2 flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <RefreshCw size={12} />
            Clear & Reset
          </button>
        </div>

        {/* Hidden canvas used by jsQR to decode frames */}
        <canvas ref={canvasRef} className="hidden" />

        <p className="text-xs text-gray-700 text-center max-w-xs">
          {cameraActive
            ? 'Camera is active — point at a QR code to scan automatically.'
            : 'Gate scanner auto-validates on paste or scan. Press Enter to manually confirm.'}
        </p>
      </div>
    </div>
  )
}
