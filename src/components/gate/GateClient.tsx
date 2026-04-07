'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { QrCode, Check, X, AlertTriangle, Loader2, User, Ticket, RefreshCw, Camera, CameraOff, DollarSign } from 'lucide-react'
import Link from 'next/link'

type ScanResult = {
  result: 'valid' | 'already_used' | 'invalid'
  message: string
  ticket?: {
    number: string
    holder: string
    email?: string
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

  const [qrInput, setQrInput] = useState('')
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [stats, setStats] = useState<Stats>({ scanned: 0, valid: 0, invalid: 0 })
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraSupported, setCameraSupported] = useState(false)

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

  // Check camera/BarcodeDetector support
  useEffect(() => {
    const hasMedia = !!(navigator.mediaDevices?.getUserMedia)
    const hasDetector = 'BarcodeDetector' in window
    setCameraSupported(hasMedia && hasDetector)
  }, [])

  // Auto-scan when QR code pasted (length threshold for UUID)
  useEffect(() => {
    if (qrInput.length >= 36) {
      handleScan(qrInput)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrInput])

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleScan = async (code: string) => {
    if (!code.trim() || scanning) return
    setScanning(true)
    setResult(null)

    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrCode: code.trim() }),
    }).then(r => r.json())

    setScanning(false)
    setQrInput('')
    if (!cameraActive) inputRef.current?.focus()

    if (res.success) {
      const data = res.data as ScanResult
      setResult(data)
      setStats(prev => ({
        scanned: prev.scanned + 1,
        valid: prev.valid + (data.result === 'valid' ? 1 : 0),
        invalid: prev.invalid + (data.result !== 'valid' ? 1 : 0),
      }))

      // Auto-clear after 4 seconds, then resume camera scanning
      setTimeout(() => {
        setResult(null)
        if (cameraActive) startScanLoop()
      }, 4000)
    }
  }

  const startScanLoop = useCallback(() => {
    const detector = (window as any)._barcodeDetector
    if (!detector || !videoRef.current) return

    const loop = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        scanLoopRef.current = requestAnimationFrame(loop)
        return
      }
      try {
        const codes = await detector.detect(videoRef.current)
        if (codes.length > 0 && codes[0].rawValue) {
          // Pause scanning while processing
          if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current)
          handleScan(codes[0].rawValue)
          return
        }
      } catch {
        // detection error — keep going
      }
      scanLoopRef.current = requestAnimationFrame(loop)
    }
    scanLoopRef.current = requestAnimationFrame(loop)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraActive])

  const startCamera = async () => {
    setCameraError(null)
    try {
      if (!('BarcodeDetector' in window)) {
        setCameraError('Camera QR scanning requires Chrome or Edge browser.')
        return
      }
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      (window as any)._barcodeDetector = detector

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access and try again.'
        : err?.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : 'Could not start camera. Please check permissions.'
      setCameraError(msg)
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

  // Start scan loop once camera is active
  useEffect(() => {
    if (cameraActive) startScanLoop()
    else {
      if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current)
    }
  }, [cameraActive, startScanLoop])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-purple-500" />
    </div>
  )

  if (!authed) return null

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="bg-[#111] border-b border-[#2a2a2a] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
            <span className="text-white font-black text-sm">N</span>
          </div>
          <div>
            <div className="font-bold text-white text-sm">NXT STOP Gate</div>
            <div className="text-xs text-gray-500">Entry Validation System</div>
          </div>
        </div>
        <Link
          href="/gate/activate"
          className="flex items-center gap-1.5 text-xs bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 rounded-lg px-3 py-1.5 transition-colors font-medium"
        >
          <DollarSign size={12} /> Sell Ticket
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <div className="font-black text-white">{stats.scanned}</div>
            <div className="text-xs text-gray-500">Scanned</div>
          </div>
          <div className="text-center">
            <div className="font-black text-green-400">{stats.valid}</div>
            <div className="text-xs text-gray-500">Valid</div>
          </div>
          <div className="text-center">
            <div className="font-black text-red-400">{stats.invalid}</div>
            <div className="text-xs text-gray-500">Rejected</div>
          </div>
        </div>
      </div>

      {/* Main scanner */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">

        {/* Camera view */}
        {cameraActive && (
          <div className="w-full max-w-sm">
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
              />
              {/* Scanning overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-purple-400 rounded-xl opacity-70">
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
        )}

        {/* Result display */}
        {result ? (
          <div className={`w-full max-w-sm border rounded-2xl p-6 text-center transition-all ${
            result.result === 'valid' ? 'scan-valid bg-green-500/5' :
            result.result === 'already_used' ? 'scan-used bg-yellow-500/5' :
            'scan-invalid bg-red-500/5'
          } card`}>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              result.result === 'valid' ? 'bg-green-500/20' :
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
              result.result === 'valid' ? 'text-green-400' :
              result.result === 'already_used' ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {result.result === 'valid' ? 'ENTRY GRANTED' :
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
          <div className="text-center">
            <div className={`w-32 h-32 rounded-2xl border-2 border-dashed flex items-center justify-center mx-auto mb-6 ${
              scanning ? 'border-purple-500 bg-purple-500/10' : 'border-[#3a3a3a]'
            }`}>
              {scanning ? (
                <Loader2 size={40} className="text-purple-400 animate-spin" />
              ) : (
                <QrCode size={48} className="text-gray-600" />
              )}
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Ready to Scan</h2>
            <p className="text-gray-500 text-sm">Use camera or paste a QR code to validate entry</p>
          </div>
        ) : null}

        {/* Camera error */}
        {cameraError && (
          <div className="w-full max-w-sm bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400 text-center">
            {cameraError}
          </div>
        )}

        {/* Camera toggle */}
        {!cameraActive && (
          <div className="w-full max-w-sm">
            {cameraSupported ? (
              <button
                onClick={startCamera}
                className="w-full flex items-center justify-center gap-2 text-sm bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 rounded-xl py-3 transition-colors font-medium mb-3"
              >
                <Camera size={16} /> Open Camera Scanner
              </button>
            ) : (
              <div className="text-center text-xs text-gray-600 mb-3">
                Camera scanning requires Chrome or Edge. Use text input below.
              </div>
            )}
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

        {/* Hidden canvas for processing */}
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
