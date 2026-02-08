# Solana Mobile Wallet Toolkit (SMWT)

A React Native-first developer-experience wrapper around **Solana Mobile Wallet Adapter (MWA)** primitives.
It provides a tiny API surface for apps that want to connect + sign on mobile without reimplementing Solana Mobile Stack.

## What it is
- A minimal DX layer: `connect()`, `disconnect()`, `signMessage()`, `getSession()`.
- One provider implementation using Solana Mobile Wallet Adapter.
- A simple demo app (three buttons + logs).

## What it is NOT
- Not a full toolkit or SDK.
- Not a replacement for Solana Mobile Stack.
- Not a wallet, protocol fork, or UI library.

## Monorepo structure
- `toolkit/smwt-core` — JS library (provider + toolkit wrapper)
- `demo` — React Native demo app
- `package.json` — root workspace config
- `demo/package.json` — demo app package config

## Quick start

The Solana Mobile Wallet Toolkit (SMWT) is designed to work with the Solana Mobile Wallet Adapter (MWA) protocol. MWA allows your app to connect with wallet apps (like Phantom, Solflare, etc.) installed on the device.

**Note:** Because MWA requires interactions between two different apps, and this demo uses native modules, **Expo Go will not work**. You must build and install the native Android app.

### Pre-requisites
- Node.js 18+ and npm.
- JDK 17 (required by modern Android Gradle toolchain).
- Android SDK + platform tools (`adb`) installed.
- Android device (physical device recommended).
- USB debugging enabled on your device.
- A Solana wallet app (for example Phantom or Solflare) installed on your device.

### 0. Install dependencies (workspace root)
Run this from the repository root:

```bash
npm install
```

### 1. Verify Android device connection
With your phone connected over USB:

```bash
adb devices
```

You should see your device listed as `device` (not `unauthorized`).

### 2. Start Metro bundler (keep this terminal open)

```bash
npm --workspace demo start
```

If your app is installed over USB, forward Metro port:

```bash
adb reverse tcp:8081 tcp:8081
```

### 3. Build debug APK

```bash
cd demo/android
./gradlew assembleDebug
```

APK output path:
`demo/android/app/build/outputs/apk/debug/app-debug.apk`

### 4. Install the app

#### Option A: Manual install
1. Transfer `app-debug.apk` to your device.
2. Open it on device and install.
3. If prompted, enable "Install unknown apps" for the file manager/browser you used.

#### Option B: ADB install
From repository root:

```bash
adb install -r demo/android/app/build/outputs/apk/debug/app-debug.apk
```

### 5. Test flow
1. Open **SMWT Demo**.
2. Tap **Connect** and approve in wallet app.
3. Confirm status shows connected public key.
4. Tap **Sign Message** and approve in wallet app.
5. Confirm signature appears in app logs/status.
6. Tap **Disconnect**.

## Troubleshooting

- **Expo Go does not work**: this project uses native modules and MWA app-to-app flows.
- **Wallet not detected / connect fails**: verify wallet is installed and unlocked on the same device.
- **App opens but JS bundle fails to load**: confirm Metro is running and run `adb reverse tcp:8081 tcp:8081`.
- **No device in `adb devices`**: reinstall USB driver (Windows), reconnect cable, and re-enable USB debugging.

## Known limitations
- Android-only (MWA is Android-first; iOS not supported in this PoC).
- Error mapping relies on heuristics for cancel/return failures.
- Session is in-memory only (no persistence).
- Single-provider only (MWA).
- Default chain is `solana:devnet`.

## Next milestones
1. Add multi-wallet discovery + user selection.
2. Add session persistence and auth token caching.
3. Expand error taxonomy from explicit MWA error codes.
4. Evaluate iOS strategy once official support exists.

## Provider API (smwt-core)

```js
import { createToolkit, createMwaProvider } from 'smwt-core';

const toolkit = createToolkit({
  provider: createMwaProvider({
    appIdentity: {
      name: 'My App',
      uri: 'https://example.com',
      icon: 'https://example.com/icon.png'
    },
    chain: 'solana:devnet'
  })
});

await toolkit.connect();
await toolkit.signMessage(new Uint8Array([1, 2, 3]));
await toolkit.disconnect();
```
