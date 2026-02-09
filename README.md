# Solana Mobile Wallet Toolkit (SMWT)

A React Native-first developer-experience wrapper around **Solana Mobile Wallet Adapter (MWA)** primitives.
It provides a tiny API surface for apps that want to connect + sign on mobile without reimplementing Solana Mobile Stack.

## Why this exists (the problem)
Local testing of Solana mobile dApps is harder than standard React Native app testing because MWA is an app-to-app protocol.
In practice, wallet handoff flows are often unreliable on emulators, especially for deep links, lifecycle switching, and wallet return/cancel behavior.
That creates a gap between "build succeeds" and "real wallet interaction works."
SMWT exists to reduce that gap and make physical-device wallet testing repeatable.
During PoC testing on physical Android devices, we validated MWA identity metadata behavior and aligned defaults for protocol-compliant integration.

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
- `demo` - React Native demo app
- `package.json` - root workspace config
- `demo/package.json` - demo app package config

## Quick start

The Solana Mobile Wallet Toolkit (SMWT) is designed to work with the Solana Mobile Wallet Adapter (MWA) protocol. MWA allows your app to connect with wallet apps (like Phantom, Solflare, etc.) installed on the device.

**Note:** Because MWA requires interactions between two different apps, and this demo uses native modules, **Expo Go will not work**. You must build and install the native Android app.

## The APK workflow (primary use case / USP)
This toolkit is primarily optimized for creating test APK builds that you can side-load onto physical Android devices.
The fastest validation path is: build/install APK -> connect to real wallet app -> test connect/sign/disconnect lifecycle.
This is the core development loop the project is designed for.

## Wallet scope (mobile vs web wallets)
SMWT targets mobile-native wallets that support Solana Mobile Wallet Adapter on Android.
Desktop browser wallets and extension-only web wallets are out of scope for this toolkit.
WalletConnect-style web flows are also not a target in this PoC.
The focus is app-to-app wallet interaction on the same device.
If a wallet works only in desktop browser context, treat it as unsupported here.
If a wallet supports MWA on Android, it is a candidate for compatibility testing.
 
### Option A (recommended): shortest path
Run from repository root:

```bash
npm install
npm --workspace demo run android
```

Then complete wallet flow on a physical device:
1. Open **SMWT Demo**.
2. Tap **Connect** and approve in wallet app.
3. Tap **Sign Message** and approve in wallet app.
4. Tap **Disconnect**.

### Option B (manual APK flow)
Use this if you want explicit APK artifacts and manual install control.

### Pre-requisites
- Node.js 18+ and npm.
- JDK 17 (required by modern Android Gradle toolchain).
- Android SDK + platform tools (`adb`) installed.
- Android device (physical device strongly recommended).
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

#### Method 1: Manual install
1. Transfer `app-debug.apk` to your device.
2. Open it on device and install.
3. If prompted, enable "Install unknown apps" for the file manager/browser you used.

#### Method 2: ADB install
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

## Expected result (demo flow)
After each action in the demo app, you should see:

1. Connect
- Wallet opens and authorization is approved.
- App status changes to `Connected`.
- Logs show `Connected`.

2. Sign Message
- Wallet opens and the sign prompt is approved.
- App shows a base64 signature preview.
- Logs show `Signing requested` and `Message signed successfully`.

3. Disconnect
- Session is closed.
- App status changes to `Disconnected`.
- Logs show `Disconnected`.

## Device recommendation
For the most reliable MWA app-to-app behavior, test on a physical Android device with a wallet app installed on the same device.
Primary wallet tested in this PoC is Phantom on Android.

## Troubleshooting

- **Expo Go does not work**: this project uses native modules and MWA app-to-app flows.
- **Wallet not detected / connect fails**: verify wallet is installed on the same device and supports MWA.
- **App opens but JS bundle fails to load**: confirm Metro is running and run `adb reverse tcp:8081 tcp:8081`.
- **No device in `adb devices`**: reinstall USB driver (Windows), reconnect cable, and re-enable USB debugging.

## Known limitations
- Android-only (MWA is Android-first; iOS not supported in this PoC).
- Error mapping relies on heuristics for cancel/return failures.
- Session is in-memory only (no persistence).
- Single-provider only (MWA).
- Default chain is `solana:devnet`.
