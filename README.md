# Solana Mobile Wallet Toolkit (SMWT)

SMWT is a lightweight React Native wrapper around Solana Mobile Wallet Adapter (MWA) for Android device testing. This PoC focuses on a stable mobile wallet flow: connect, sign message, and disconnect with clean error handling.

## Requirements

- Android physical device (recommended for reliable app-to-app wallet handoff)
- Phantom wallet installed on the same device
- React Native Android environment (Node.js 18+, JDK 17, Android SDK/ADB)
- This project does not support iOS or Expo Go in the PoC

## Run Demo (Android)

1. Install dependencies from repo root:

```bash
npm install
```

2. Start Metro:

```bash
npm --workspace demo start
```

3. In another terminal, connect your Android device and run the app:

```bash
npm --workspace demo run android
```

4. If Metro is not reachable from device, run:

```bash
adb reverse tcp:8081 tcp:8081
```

## Reproducible Demo Instructions

1. Open **SMWT PoC Demo** on Android.
2. Tap **CONNECT** and approve in Phantom.
3. Verify status shows `Connected: <publicKey>`.
4. Tap **SIGN MESSAGE** and approve in Phantom.
5. Verify signature appears in the app under **Signature (base64)**.
6. Tap **COPY** and confirm clipboard contains signature.
7. Tap **DISCONNECT** and verify status returns to `Disconnected`.

## Signing Flow (Expected Wallet Behavior)

- `CONNECT` opens Phantom authorization prompt.
- `SIGN MESSAGE` opens Phantom signing prompt for message `SMWT PoC signing test`.
- After approval, Phantom returns to app and signature is shown in base64.
- If user declines, app shows a short declined reason and retry guidance.

## Troubleshooting

- Wallet not found: install/update Phantom on the same Android device.
- Wallet opens but app does not resume: return manually to SMWT and retry signing.
- Timeout errors: retry while keeping wallet/app active during handoff.
- Invalid session/token errors: reconnect wallet, then sign again.
- Metro connection issues: run `adb reverse tcp:8081 tcp:8081`.

## Known Limitations

- Android-only PoC (no iOS support).
- MWA app-to-app deep link return can vary by wallet/device state.
- In-memory session only (no persistence).

## Release Notes (v0.1)

- Minimal Android demo flow stabilized: connect, sign, disconnect.
- Logs cleaned for normal mode with optional debug verbosity.
- README simplified for reproducible physical-device demo.

## License

MIT
