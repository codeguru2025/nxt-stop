# NXT STOP Gate App

Native Android QR scanner for ticket validation at the gate.

## Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/): `npm install -g expo-cli eas-cli`
- Expo account: [expo.dev](https://expo.dev) (free) — required for EAS Build

## Setup

```bash
cd gate-app
npm install
```

## Build APK (no Android Studio needed)

1. **Log in to Expo:**
   ```bash
   eas login
   ```

2. **Configure the project (first time only):**
   ```bash
   eas build:configure
   ```

3. **Build the APK:**
   ```bash
   npm run build:apk
   ```
   EAS builds in the cloud. When complete (~5–10 min) you get a download link for the `.apk` file.

4. **Install on Android:**
   - Download the APK to the Android device
   - Enable "Install from unknown sources" in Settings → Security
   - Open the APK to install

## Run locally (for testing)

```bash
npm start
```
Scan the QR code with the Expo Go app on your phone.

## How it works

- Login with your gate staff or admin phone number + password
- Camera opens automatically and scans QR codes from tickets
- Results:
  - **Green ✓ ENTRY GRANTED** — valid ticket, marked as used
  - **Yellow ! ALREADY USED** — ticket scanned before
  - **Red ✗ INVALID** — not found, wrong event, cancelled, etc.
- Haptic feedback on every scan result
- Auto-resets camera 3 seconds after each scan
- Session persists between app opens (no re-login needed)
- Manual ticket ID input at the bottom as fallback

## Backend

Calls `https://nxt-stop-lp27d.ondigitalocean.app/api/scan` — requires an active gate staff or admin session.
