import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Vibration,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { scanTicket, logout, getScanStats, type ScanResult } from './api'

type Props = { onLogout: () => void }

type Stats = { scanned: number; valid: number; invalid: number; early: number }

export default function ScannerScreen({ onLogout }: Props) {
  const [permission, requestPermission] = useCameraPermissions()
  const [result, setResult] = useState<ScanResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [stats, setStats] = useState<Stats>({ scanned: 0, valid: 0, invalid: 0, early: 0 })
  const [cameraActive, setCameraActive] = useState(true)
  const scanningRef = useRef(false)
  const autoResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!permission?.granted) requestPermission()
    getScanStats().then(s => setStats({
      scanned: s.scanned,
      valid: s.valid,
      invalid: s.invalid,
      early: s.early,
    }))
  }, [])

  useEffect(() => {
    return () => {
      if (autoResetRef.current) clearTimeout(autoResetRef.current)
    }
  }, [])

  const updateStats = (r: ScanResult) => {
    setStats(prev => ({
      scanned: prev.scanned + 1,
      valid: prev.valid + (r.result === 'valid' ? 1 : 0),
      invalid: prev.invalid + (r.result === 'invalid' ? 1 : 0),
      early: prev.early + (r.result === 'early_scan' ? 1 : 0),
    }))
  }

  const triggerHaptic = (r: ScanResult['result']) => {
    try {
      if (r === 'valid') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } else if (r === 'already_used' || r === 'early_scan') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        Vibration.vibrate([0, 80, 60, 80])
      }
    } catch {}
  }

  const handleScan = useCallback(async (code: string) => {
    if (!code.trim() || scanningRef.current) return
    scanningRef.current = true
    setScanning(true)
    setCameraActive(false)
    if (autoResetRef.current) clearTimeout(autoResetRef.current)

    try {
      const data = await scanTicket(code.trim())
      setResult(data)
      updateStats(data)
      triggerHaptic(data.result)

      // Auto-reset camera after 3s for valid/used, 4s for invalid
      const delay = data.result === 'invalid' ? 4000 : 3000
      autoResetRef.current = setTimeout(() => {
        resetScan()
      }, delay)
    } catch (e: any) {
      if (e?.message === 'SESSION_EXPIRED') {
        Alert.alert('Session Expired', 'Please log in again.', [
          { text: 'OK', onPress: onLogout },
        ])
      } else {
        setResult({
          result: 'invalid',
          message: e?.message ?? 'Network error — check connection',
        })
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        autoResetRef.current = setTimeout(resetScan, 4000)
      }
    } finally {
      setScanning(false)
      setManualCode('')
      scanningRef.current = false
    }
  }, [onLogout])

  const resetScan = () => {
    setResult(null)
    setCameraActive(true)
    if (autoResetRef.current) {
      clearTimeout(autoResetRef.current)
      autoResetRef.current = null
    }
  }

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout()
          onLogout()
        },
      },
    ])
  }

  const resultColor =
    result?.result === 'valid'      ? '#22c55e'
    : result?.result === 'early_scan' ? '#06b6d4'
    : result?.result === 'already_used' ? '#f59e0b'
    : '#ef4444'

  const resultBg =
    result?.result === 'valid'      ? '#22c55e18'
    : result?.result === 'early_scan' ? '#06b6d418'
    : result?.result === 'already_used' ? '#f59e0b18'
    : '#ef444418'

  const resultLabel =
    result?.result === 'valid'      ? 'ENTRY GRANTED'
    : result?.result === 'early_scan' ? 'VERIFIED — NOT TODAY'
    : result?.result === 'already_used' ? 'ALREADY USED'
    : 'INVALID TICKET'

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Gate Scanner</Text>
          <Text style={styles.headerSub}>NXT STOP</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: 'Scanned', value: stats.scanned, color: '#fff' },
          { label: 'Admitted', value: stats.valid, color: '#22c55e' },
          { label: 'Early', value: stats.early, color: '#06b6d4' },
          { label: 'Invalid', value: stats.invalid, color: '#ef4444' },
        ].map(s => (
          <View key={s.label} style={styles.statBox}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Main area */}
      <View style={styles.main}>
        {result ? (
          /* ── Result card ── */
          <View style={[styles.resultCard, { backgroundColor: resultBg, borderColor: resultColor + '40' }]}>
            <View style={[styles.resultIcon, { backgroundColor: resultColor + '25' }]}>
              <Text style={[styles.resultIconText, { color: resultColor }]}>
                {result.result === 'valid' ? '✓' : result.result === 'already_used' ? '!' : '✗'}
              </Text>
            </View>

            <Text style={[styles.resultLabel, { color: resultColor }]}>{resultLabel}</Text>
            <Text style={styles.resultMessage}>{result.message}</Text>

            {result.ticket && (
              <View style={styles.ticketInfo}>
                <Text style={styles.ticketHolder}>{result.ticket.holder}</Text>
                {result.ticket.phone && (
                  <Text style={styles.ticketDetail}>{result.ticket.phone}</Text>
                )}
                <View style={[styles.ticketTypeBadge, { backgroundColor: result.ticket.color ?? '#8B5CF6' }]}>
                  <Text style={styles.ticketTypeText}>{result.ticket.type}</Text>
                </View>
                {result.ticket.event && (
                  <Text style={styles.ticketEvent}>{result.ticket.event}</Text>
                )}
                <Text style={styles.ticketNumber}>{result.ticket.number}</Text>
                {result.usedAt && (
                  <Text style={styles.usedAt}>
                    Used at: {new Date(result.usedAt).toLocaleTimeString()}
                  </Text>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.scanAgainBtn} onPress={resetScan}>
              <Text style={styles.scanAgainText}>Scan Next Ticket</Text>
            </TouchableOpacity>
          </View>
        ) : scanning ? (
          /* ── Scanning spinner ── */
          <View style={styles.scanningWrap}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={styles.scanningText}>Validating...</Text>
          </View>
        ) : permission?.granted && cameraActive ? (
          /* ── Camera ── */
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              onBarcodeScanned={({ data }) => handleScan(data)}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            />
            {/* Overlay corners */}
            <View style={styles.overlay}>
              <View style={styles.scanBox}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <Text style={styles.cameraHint}>Point at QR code</Text>
            </View>
          </View>
        ) : (
          /* ── No permission / camera off ── */
          <TouchableOpacity
            style={styles.cameraPrompt}
            onPress={() => {
              if (!permission?.granted) {
                requestPermission()
              } else {
                setCameraActive(true)
              }
            }}
          >
            <Text style={styles.cameraPromptIcon}>📷</Text>
            <Text style={styles.cameraPromptText}>
              {permission?.granted ? 'Tap to start camera' : 'Allow camera access'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Manual input */}
      <View style={styles.manualWrap}>
        <TextInput
          style={styles.manualInput}
          value={manualCode}
          onChangeText={setManualCode}
          placeholder="Paste ticket ID manually..."
          placeholderTextColor="#444"
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => handleScan(manualCode)}
          editable={!scanning}
        />
        <TouchableOpacity
          style={[styles.manualBtn, (!manualCode.trim() || scanning) && styles.manualBtnDisabled]}
          onPress={() => handleScan(manualCode)}
          disabled={!manualCode.trim() || scanning}
        >
          <Text style={styles.manualBtnText}>Go</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const PURPLE = '#8B5CF6'

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    backgroundColor: '#111',
  },
  headerTitle: { color: '#fff', fontWeight: '900', fontSize: 16 },
  headerSub: { color: '#666', fontSize: 11, marginTop: 1 },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  logoutText: { color: '#999', fontSize: 13 },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  statValue: { fontSize: 26, fontWeight: '900' },
  statLabel: { color: '#555', fontSize: 11, marginTop: 2 },

  main: {
    flex: 1,
    overflow: 'hidden',
  },

  /* Camera */
  cameraWrap: { flex: 1, position: 'relative' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBox: {
    width: 220,
    height: 220,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: PURPLE,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 6 },
  cameraHint: {
    marginTop: 20,
    color: '#c4b5fdcc',
    fontSize: 13,
    backgroundColor: '#00000099',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },

  cameraPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraPromptIcon: { fontSize: 56, marginBottom: 12 },
  cameraPromptText: { color: PURPLE, fontSize: 15, fontWeight: '700' },

  /* Scanning */
  scanningWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  scanningText: { color: '#999', fontSize: 15 },

  /* Result */
  resultCard: {
    flex: 1,
    margin: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  resultIconText: { fontSize: 44, fontWeight: '900', lineHeight: 52 },
  resultLabel: { fontSize: 26, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
  resultMessage: { color: '#999', fontSize: 14, marginBottom: 16, textAlign: 'center' },

  ticketInfo: {
    width: '100%',
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  ticketHolder: { color: '#fff', fontSize: 20, fontWeight: '800' },
  ticketDetail: { color: '#999', fontSize: 13 },
  ticketTypeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 20,
    marginVertical: 4,
  },
  ticketTypeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  ticketEvent: { color: '#888', fontSize: 12 },
  ticketNumber: { color: '#444', fontSize: 11, fontFamily: 'monospace' },
  usedAt: { color: '#f59e0b', fontSize: 12, marginTop: 4 },

  scanAgainBtn: {
    backgroundColor: PURPLE,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  scanAgainText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  /* Manual input */
  manualWrap: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    backgroundColor: '#0a0a0a',
  },
  manualInput: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: 'monospace',
  },
  manualBtn: {
    backgroundColor: PURPLE,
    borderRadius: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualBtnDisabled: { opacity: 0.4 },
  manualBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
})
