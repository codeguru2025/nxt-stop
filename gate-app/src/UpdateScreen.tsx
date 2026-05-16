import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native'

type Props = { downloadUrl: string | null }

export default function UpdateScreen({ downloadUrl }: Props) {
  const openDownload = () => {
    const url = downloadUrl ?? 'https://nxt-stop-lp27d.ondigitalocean.app/gate'
    Linking.openURL(url)
  }

  return (
    <View style={styles.root}>
      <Text style={styles.icon}>🔄</Text>
      <Text style={styles.title}>Update Required</Text>
      <Text style={styles.body}>
        This version of NXT STOP Gate is no longer supported.{'\n'}
        Please download the latest version to continue.
      </Text>
      <TouchableOpacity style={styles.btn} onPress={openDownload} activeOpacity={0.8}>
        <Text style={styles.btnText}>Download Latest Version</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>Ask your manager if you need help installing the update.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  icon: { fontSize: 64, marginBottom: 24 },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  btn: {
    backgroundColor: '#8B5CF6',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  hint: {
    color: '#444',
    fontSize: 12,
    textAlign: 'center',
  },
})
