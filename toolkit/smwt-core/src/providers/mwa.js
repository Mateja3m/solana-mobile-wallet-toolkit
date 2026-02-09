import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import bs58 from 'bs58';
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

  const isWalletPackageAvailable = () => typeof transact === 'function';

  const log = (level, message, meta) => {
    if (!logger) return;
    if (typeof logger[level] === 'function') {
      logger[level](message, meta);
    } else if (typeof logger.log === 'function') {
      logger.log(message, meta);
    }
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

  const decodeBase64Address = (address) => {
    if (typeof address !== 'string') return null;
    const bufferCtor = globalThis?.Buffer;
    if (!bufferCtor || typeof bufferCtor.from !== 'function') return null;

    try {
      const bytes = bufferCtor.from(address, 'base64');
      if (bytes.length !== 32) return null;

      const normalizedInput = address.replace(/=+$/g, '');
      const normalizedDecoded = bytes.toString('base64').replace(/=+$/g, '');
      if (normalizedInput !== normalizedDecoded) return null;

      return Uint8Array.from(bytes);
    } catch (_error) {
      return null;
    }
  };

  const normalizeAuthorizedAccount = (account) => {
    const adapterAddress = account?.address;
    if (typeof adapterAddress !== 'string' || adapterAddress.length === 0) {
      throw new SMWTError(
        ErrorCode.AUTHORIZATION_FAILED,
        'Authorization succeeded but returned an invalid account address.'
      );
    }

    const addressBytes = decodeBase64Address(adapterAddress);
    const publicKey = addressBytes ? bs58.encode(addressBytes) : adapterAddress;

    return {
      adapterAddress,
      publicKey,
      addressEncoding: addressBytes ? 'base64' : 'string'
    };
  };

  const assertSigningPreflight = () => {
    if (!isWalletPackageAvailable()) {
      throw new SMWTError(
        ErrorCode.WALLET_NOT_INSTALLED,
        'Mobile Wallet Adapter package is unavailable. Reinstall dependencies and retry.'
      );
    }

    if (!session) {
      throw new SMWTError(
        ErrorCode.NOT_CONNECTED,
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
    if (!session.accountAddress) {
      throw new SMWTError(
        ErrorCode.AUTHORIZATION_FAILED,
        'Missing wallet adapter account reference. Reconnect Phantom before signing.'
      );
    }
    if (Platform.OS !== 'android') {
      throw new SMWTError(
        ErrorCode.PLATFORM_NOT_SUPPORTED,
        'MWA provider is Android-only in this PoC.'
      );
    }
  };

  const logWalletError = (scope, error) => {
    log('error', `[MWA:${scope}] Wallet adapter error: ${error?.message || String(error)}`);
  };

  const applyAuthorizationResult = (authorizationResult) => {
    const normalizedAccount = normalizeAuthorizedAccount(authorizationResult.accounts[0]);
    authToken = authorizationResult.auth_token || authToken;
    session = {
      publicKey: normalizedAccount.publicKey,
      accountAddress: normalizedAccount.adapterAddress,
      addressEncoding: normalizedAccount.addressEncoding,
      walletName: authorizationResult.wallet_name || 'MWA Wallet',
      authToken
    };

    log('info', `Connected to ${session.walletName}.`);
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
        log('warn', 'Reauthorize failed. Retrying with authorize + existing auth token.');
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
      assertSigningPreflight();

      if (!(message instanceof Uint8Array) || !isUtf8Message(message)) {
        throw new SMWTError(
          ErrorCode.INVALID_MESSAGE,
          'Message must be UTF-8 encoded bytes (Uint8Array).'
        );
      }

      const signOnce = async ({ tokenForAuthorize }) => transact(async (wallet) => {
        // Every transact call starts a new wallet session; re-authorize using the current auth token.
        const activeSession = await authorizeInSession(wallet, tokenForAuthorize);
        const signingAddress = activeSession.accountAddress;

        // @solana-mobile/mobile-wallet-adapter-protocol-web3js expects object params with payloads[].
        const result = await wallet.signMessages({
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
          log('warn', 'Auth token rejected. Attempting a fresh authorize + one retry.');
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
