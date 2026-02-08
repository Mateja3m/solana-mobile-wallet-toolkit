import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { Platform } from 'react-native';
import { ErrorCode, SMWTError, normalizeProviderError } from '../errors.js';

const SIGN_DECLINED_LOCKED_THRESHOLD_MS = 1500;

export function createMwaProvider(options = {}) {
  const {
    appIdentity = {
      name: 'SMWT Demo',
      // MWA expects icon to be a relative URI.
      icon: 'icon.png'
    },
    chain = 'solana:devnet',
    logger
  } = options;

  let authToken = null;
  let session = null;

  const isWalletPackageAvailable = () => typeof transact === 'function';

  const log = (level, message, meta) => {
    if (!logger) return;
    if (typeof logger[level] === 'function') {
      logger[level](message, meta);
    } else if (typeof logger.log === 'function') {
      logger.log(message, meta);
    }
  };

  const maskToken = (token) => {
    if (!token) return '(none)';
    const tail = token.slice(-6);
    return `***${tail}`;
  };

  const isAuthRelatedError = (error) => {
    const message = String(error?.message || error).toLowerCase();
    return (
      message.includes('auth_token not valid for signing') ||
      message.includes('auth token not valid for signing') ||
      message.includes('auth_token') ||
      message.includes('authorization') ||
      message.includes('reauthorize') ||
      message.includes('not authorized')
    );
  };

  const isDeclinedError = (error) => {
    const message = String(error?.message || error).toLowerCase();
    const code = Number(error?.code);
    return (
      code === -3 ||
      message.includes('declined') ||
      message.includes('rejected') ||
      message.includes('request declined')
    );
  };

  const isTimeoutError = (error) => {
    const message = String(error?.message || error).toLowerCase();
    return message.includes('timeout') || message.includes('timed out');
  };

  const isUtf8Message = (value) => {
    if (!(value instanceof Uint8Array)) return false;
    if (typeof TextDecoder !== 'function') return true;
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      decoder.decode(value);
      return true;
    } catch (_error) {
      return false;
    }
  };

  const toBase64Prefix = (bytes, prefixLength = 12) => {
    try {
      if (globalThis?.Buffer && typeof globalThis.Buffer.from === 'function') {
        return globalThis.Buffer.from(bytes).toString('base64').slice(0, prefixLength);
      }
      if (typeof btoa === 'function') {
        let binary = '';
        for (let i = 0; i < bytes.length; i += 1) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary).slice(0, prefixLength);
      }
    } catch (_error) {
      // fall through to unavailable marker
    }
    return 'unavailable';
  };

  const assertSigningPreflight = async () => {
    if (!isWalletPackageAvailable()) {
      throw new SMWTError(
        ErrorCode.WALLET_NOT_INSTALLED,
        'Mobile Wallet Adapter package is unavailable. Reinstall dependencies and retry.'
      );
    }

    if (!session) {
      throw new SMWTError(
        ErrorCode.AUTHORIZATION_FAILED,
        'No active wallet session. Connect Phantom before signing.'
      );
    }

    if (!session.authToken) {
      throw new SMWTError(
        ErrorCode.AUTH_TOKEN_INVALID,
        'Missing wallet auth token. Reconnect Phantom before signing.'
      );
    }

    if (!session.publicKey) {
      throw new SMWTError(
        ErrorCode.AUTHORIZATION_FAILED,
        'Missing wallet account. Reconnect Phantom before signing.'
      );
    }

    const available = await Promise.resolve(Platform.OS === 'android');
    if (!available) {
      throw new SMWTError(
        ErrorCode.WALLET_NOT_INSTALLED,
        'No compatible wallet detected on this device.'
      );
    }
  };

  const logWalletError = (scope, error) => {
    log('error', `[MWA:${scope}] Wallet adapter error: ${error?.message || String(error)}`);
  };

  const applyAuthorizationResult = (authorizationResult) => {
    authToken = authorizationResult.auth_token || authToken;
    session = {
      publicKey: authorizationResult.accounts[0].address,
      walletName: authorizationResult.wallet_name || 'MWA Wallet',
      authToken
    };

    log(
      'info',
      `[MWA:authorize] accounts=${authorizationResult.accounts.length} wallet=${session.walletName} token=${maskToken(authToken)}`
    );

    return session;
  };

  const performAuthorize = async (wallet, tokenToUse) => {
    if (tokenToUse && typeof wallet.reauthorize === 'function') {
      return wallet.reauthorize({
        auth_token: tokenToUse,
        identity: appIdentity
      });
    }

    return wallet.authorize({
      chain,
      identity: appIdentity,
      auth_token: tokenToUse || undefined
    });
  };

  const authorizeInSession = async (wallet, tokenToUse) => {
    let authorizationResult;
    try {
      authorizationResult = await performAuthorize(wallet, tokenToUse);
    } catch (error) {
      // Some wallets may reject reauthorize but accept authorize+auth_token.
      if (tokenToUse) {
        log('warn', `[MWA:authorize] reauthorize failed, retrying authorize with existing token ${maskToken(tokenToUse)}.`);
        authorizationResult = await wallet.authorize({
          chain,
          identity: appIdentity,
          auth_token: tokenToUse
        });
      } else {
        throw error;
      }
    }

    if (!authorizationResult || !authorizationResult.accounts || authorizationResult.accounts.length === 0) {
      throw new SMWTError(
        ErrorCode.UNKNOWN,
        'Authorization succeeded but returned no accounts.'
      );
    }

    return applyAuthorizationResult(authorizationResult);
  };

  return {
    name: 'Solana Mobile Wallet Adapter',

    async isAvailable() {
      return Platform.OS === 'android';
    },

    async connect() {
      if (Platform.OS !== 'android') {
        throw new SMWTError(
          ErrorCode.PLATFORM_NOT_SUPPORTED,
          'MWA provider is Android-only in this PoC.'
        );
      }

      try {
        return await transact(async (wallet) => {
          return authorizeInSession(wallet, authToken);
        });
      } catch (error) {
        logWalletError('connect', error);
        throw normalizeProviderError(error);
      }
    },

    async disconnect() {
      if (!authToken) {
        session = null;
        return;
      }

      try {
        await transact(async (wallet) => {
          await wallet.deauthorize({ auth_token: authToken });
        });
      } catch (error) {
        logWalletError('disconnect', error);
        throw normalizeProviderError(error);
      } finally {
        authToken = null;
        session = null;
      }
    },

    async signMessage(message) {
      await assertSigningPreflight();

      if (!(message instanceof Uint8Array) || !isUtf8Message(message)) {
        throw new SMWTError(
          ErrorCode.INVALID_MESSAGE,
          'Message must be UTF-8 encoded bytes (Uint8Array).'
        );
      }

      log(
        'info',
        `[MWA:sign] payload validation ok bytes=${message.length} base64_prefix=${toBase64Prefix(message)}`
      );

      const signOnce = async ({ tokenForAuthorize }) => transact(async (wallet) => {
        // Every transact call starts a new wallet session; re-authorize using the current auth token.
        const activeSession = await authorizeInSession(wallet, tokenForAuthorize);
        const signingAddress = activeSession.publicKey;
        log(
          'info',
          `[MWA:sign] using auth token ${maskToken(activeSession.authToken)} address=${signingAddress} bytes=${message.length}`
        );

        // @solana-mobile/mobile-wallet-adapter-protocol-web3js expects object params with payloads[].
        const result = await wallet.signMessages({
          auth_token: activeSession.authToken,
          payloads: [message],
          addresses: [signingAddress]
        });

        if (!result || !result.signed_payloads || result.signed_payloads.length === 0) {
          throw new SMWTError(
            ErrorCode.UNKNOWN,
            'Wallet did not return a signed payload.'
          );
        }

        return result.signed_payloads[0];
      });

      const signStartedAt = Date.now();
      log('info', `[MWA:sign] request launched at=${new Date(signStartedAt).toISOString()}`);

      try {
        const signedPayload = await signOnce({ tokenForAuthorize: session.authToken });
        const durationMs = Date.now() - signStartedAt;
        log('info', `[MWA:sign] request completed in ${durationMs}ms`);
        return signedPayload;
      } catch (error) {
        const durationMs = Date.now() - signStartedAt;
        logWalletError('sign', error);
        log(
          'warn',
          `[MWA:sign] request failed after ${durationMs}ms (code=${error?.code ?? 'UNKNOWN'}).`
        );

        const declined = isDeclinedError(error);
        const likelyWalletLockedOrAborted =
          declined && durationMs < SIGN_DECLINED_LOCKED_THRESHOLD_MS;

        if (likelyWalletLockedOrAborted) {
          log(
            'warn',
            `[MWA:sign] LIKELY_WALLET_LOCKED_OR_ABORTED: declined in ${durationMs}ms (<${SIGN_DECLINED_LOCKED_THRESHOLD_MS}ms).`
          );
          throw normalizeProviderError(error, { walletLockedOrAborted: true });
        }

        if (declined) {
          log(
            'warn',
            `[MWA:sign] USER_DECLINED_APPROVAL: user declined signing in wallet UI after ${durationMs}ms.`
          );
          throw normalizeProviderError(error);
        }

        if (isTimeoutError(error)) {
          throw normalizeProviderError(error);
        }

        if (isAuthRelatedError(error)) {
          log('warn', '[MWA:sign] auth token rejected, attempting a fresh authorize and single retry.');
          try {
            // Single retry with a fresh authorize().
            const retrySignedPayload = await signOnce({ tokenForAuthorize: undefined });
            const totalDurationMs = Date.now() - signStartedAt;
            log('info', `[MWA:sign] request completed after retry in ${totalDurationMs}ms`);
            return retrySignedPayload;
          } catch (retryError) {
            logWalletError('sign-retry', retryError);
            throw normalizeProviderError(retryError);
          }
        }

        throw normalizeProviderError(error);
      }
    }
  };
}
