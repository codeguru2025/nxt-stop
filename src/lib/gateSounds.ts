export type GateScanTone = 'valid' | 'already_used' | 'invalid' | 'error'

let sharedCtx: AudioContext | null = null

/** Call on user gestures (camera, validate) so the first beep isn’t blocked. */
export function unlockGateAudio(): void {
  void getOrCreateContext()?.resume()
}

function getOrCreateContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new AC()
  }
  return sharedCtx
}

/**
 * Gate scan feedback — loud, immediate onset (no fade-in), max practical output.
 * Reuses one AudioContext so playback starts right away after the first unlock.
 */
export function playGateScanTone(kind: GateScanTone): void {
  const ctx = getOrCreateContext()
  if (!ctx) return

  try {
    void ctx.resume()

    const master = ctx.createGain()
    /** Unity gain — as loud as the Web Audio graph allows without extra attenuation */
    master.gain.value = 1
    master.connect(ctx.destination)

    const now = ctx.currentTime

    const beep = (
      freq: number,
      start: number,
      dur: number,
      type: OscillatorType = 'sine'
    ) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, start)
      // Instant full level, short tail to avoid speaker click
      g.gain.setValueAtTime(1, start)
      const releaseStart = start + Math.max(dur - 0.012, 0)
      g.gain.setValueAtTime(1, releaseStart)
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
      osc.connect(g)
      g.connect(master)
      osc.start(start)
      osc.stop(start + dur + 0.02)
    }

    if (kind === 'valid') {
      beep(784, now, 0.1)
      beep(1046.5, now + 0.1, 0.14)
    } else if (kind === 'already_used') {
      beep(523, now, 0.08)
      beep(523, now + 0.12, 0.08)
    } else if (kind === 'invalid') {
      beep(185, now, 0.2, 'square')
      beep(155, now + 0.24, 0.26, 'square')
    } else {
      beep(300, now, 0.05)
      beep(240, now + 0.07, 0.05)
      beep(180, now + 0.14, 0.07, 'triangle')
    }

    // Detach master after this pattern finishes (context stays open for next scan)
    const doneAt =
      kind === 'valid'
        ? 280
        : kind === 'already_used'
          ? 240
          : kind === 'invalid'
            ? 520
            : 250
    window.setTimeout(() => {
      try {
        master.disconnect()
      } catch {
        /* noop */
      }
    }, doneAt)
  } catch {
    // Ignore if AudioContext blocked or unsupported
  }
}
