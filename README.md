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

## Quick start

```bash
npm install
npm run demo:start
```

Android (device or emulator):

```bash
npm run demo:android
```

Or manually:

From root:
```bash
npm --workspace demo run android
```

From demo folder:
```bash
npx expo run:android
```

## Demo script
1. Install a Solana Mobile Wallet Adapter compatible wallet on Android.
2. Run the demo app on Android.
3. Tap **Connect** → approve in wallet.
4. Tap **Sign Message** → approve in wallet → base64 signature appears.
5. Tap **Disconnect**.

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
