import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { Platform } from 'react-native';
import { ErrorCode, SMWTError, normalizeProviderError } from '../errors.js';

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
      if (!session || !session.authToken) {
        throw new SMWTError(
          ErrorCode.NOT_CONNECTED,
          'Wallet not connected or auth token missing. Connect again before signing.'
        );
      }

      if (!(message instanceof Uint8Array)) {
        throw new SMWTError(ErrorCode.INVALID_MESSAGE, 'Message must be a Uint8Array.');
      }

      const signOnce = async ({ tokenForAuthorize }) => transact(async (wallet) => {
        // Every transact call starts a new wallet session; re-authorize using the current auth token.
        const activeSession = await authorizeInSession(wallet, tokenForAuthorize);
        const signingAddress = activeSession.publicKey;
        log(
          'info',
          `[MWA:sign] using auth token ${maskToken(activeSession.authToken)} address=${signingAddress} bytes=${message.length}`
        );

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

      try {
        return await signOnce({ tokenForAuthorize: session.authToken });
      } catch (error) {
        logWalletError('sign', error);

        if (isAuthRelatedError(error)) {
          log('warn', '[MWA:sign] auth token rejected, attempting a fresh authorize and single retry.');
          try {
            // Single retry with a fresh authorize().
            return await signOnce({ tokenForAuthorize: undefined });
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
