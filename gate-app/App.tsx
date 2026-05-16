import React, { useState, useEffect } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import Constants from 'expo-constants'
import LoginScreen from './src/LoginScreen'
import ScannerScreen from './src/ScannerScreen'
import UpdateScreen from './src/UpdateScreen'
import { checkSession } from './src/api'

const BASE = 'https://nxt-stop-lp27d.ondigitalocean.app'

type Screen = 'loading' | 'update' | 'login' | 'scanner'

async function checkVersion(): Promise<{ updateRequired: boolean; downloadUrl: string | null }> {
  try {
    const res = await fetch(`${BASE}/api/app/version`)
    const data = await res.json()
    if (!data.success) return { updateRequired: false, downloadUrl: null }
    const currentCode: number = Constants.expoConfig?.android?.versionCode ?? 1
    const minCode: number = data.data?.minVersionCode ?? 1
    return {
      updateRequired: currentCode < minCode,
      downloadUrl: data.data?.downloadUrl ?? null,
    }
  } catch {
    return { updateRequired: false, downloadUrl: null }
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading')
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const { updateRequired, downloadUrl: url } = await checkVersion()
      if (updateRequired) {
        setDownloadUrl(url)
        setScreen('update')
        return
      }
      const { loggedIn } = await checkSession()
      setScreen(loggedIn ? 'scanner' : 'login')
    })()
  }, [])

  if (screen === 'loading') {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <StatusBar style="light" />
      </View>
    )
  }

  if (screen === 'update') {
    return (
      <>
        <UpdateScreen downloadUrl={downloadUrl} />
        <StatusBar style="light" />
      </>
    )
  }

  if (screen === 'login') {
    return (
      <>
        <LoginScreen onLogin={() => setScreen('scanner')} />
        <StatusBar style="light" />
      </>
    )
  }

  return (
    <>
      <ScannerScreen onLogout={() => setScreen('login')} />
      <StatusBar style="light" />
    </>
  )
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
