# Research notes (Feb 6, 2026)

Goal: pick the simplest feasible React Native mobile wallet connection method without reimplementing Solana Mobile Stack.

## Option A: Solana Mobile Wallet Adapter (MWA) protocol via official JS wrappers
- Official approach for Android in Solana Mobile Stack.
- Uses `transact(...)` flow to open a compatible wallet and request authorize/sign.
- Has a web3js-oriented wrapper package that works in React Native when properly configured.
- Android-first; iOS support is not part of the MWA protocol today.

## Option B: Direct deep links to a single wallet
- Requires wallet-specific APIs and message signing formats.
- Harder to guarantee correctness and portability.
- Risks drifting from official Solana protocol behavior.

## Decision
Use Option A for the PoC: `@solana-mobile/mobile-wallet-adapter-protocol` + `@solana-mobile/mobile-wallet-adapter-protocol-web3js`.
This keeps us on official Solana primitives, avoids reimplementing protocols, and delivers a real Android flow quickly.

Deferred: iOS support, multi-wallet discovery, and production-grade UX.
