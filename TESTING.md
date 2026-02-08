# SMWT Manual Testing Plan

## Prerequisites
- Android physical device
- SMWT demo app installed and running
- Phantom (or another MWA wallet) installed on same device
- Wallet unlocked before signing tests
- Metro running (`npm --workspace demo start`) and `adb reverse tcp:8081 tcp:8081` set

## 1. Connect Flow
1. Open the demo app.
2. Tap `Connect`.
3. Approve in Phantom.
4. Verify status shows connected public key.
5. Verify logs include connection success and no error code.

## 2. Sign Flow (Happy Path)
1. Ensure wallet is unlocked.
2. Select each `Test Message` option one by one:
   - `hello`
   - `SMWT PoC signing test`
   - `JSON with timestamp`
3. Tap `Sign Message`.
4. Approve in Phantom.
5. Verify logs show:
   - message bytes length
   - base64 prefix
   - successful signing duration
6. Verify signature preview appears and can be copied.

## 3. Cancel Flow (User Decline)
1. Tap `Sign Message`.
2. In Phantom approval UI, tap reject/cancel.
3. Verify error code in logs is `USER_DECLINED_APPROVAL`.
4. Verify guidance instructs user to approve in Phantom.

## 4. Locked Wallet / Aborted Flow
1. Lock Phantom.
2. Tap `Sign Message` in demo.
3. If app returns quickly from wallet, verify error code is `WALLET_LOCKED_OR_ABORTED`.
4. Verify guidance says to open Phantom, unlock, then retry signing.
5. Unlock Phantom first, then retry `Sign Message` and confirm success.
