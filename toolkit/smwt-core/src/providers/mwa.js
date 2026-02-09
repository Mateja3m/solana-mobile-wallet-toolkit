import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import bs58 from 'bs58';
import { Platform } from 'react-native';
import { ErrorCode, SMWTError, normalizeProviderError } from '../errors.js';

const FLOW_ABORTED_THRESHOLD_MS = 1500;

export function createMwaProvider(options = {}) {
  const {
    appIdentity = {
      name: 'SMWT Demo',
      uri: 'https://github.com/Mateja3m/solana-mobile-wallet-toolkit'
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

  const maskAddress = (value) => {
    if (!value || typeof value !== 'string') return '(none)';
    if (value.length <= 12) return value;
    return `${value.slice(0, 6)}...${value.slice(-6)}`;
  };

  const isDeclinedError = (error) => {
    const code = Number(error?.code);
    const message = String(error?.message || error).toLowerCase();
    return (
      code === -3 ||
      message.includes('declined') ||
      message.includes('rejected') ||
      message.includes('not signed')
    );
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

  const getByteArrayPreview = (value, prefixLength = 8) => {
    if (!(value instanceof Uint8Array)) return 'n/a';
    const size = Math.min(prefixLength, value.length);
    const prefix = Array.from(value.slice(0, size))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    return prefix;
  };

  const inspectSignResult = (result) => {
    if (Array.isArray(result)) {
      const first = result[0];
      log(
        'info',
        `[MWA:sign] result=array length=${result.length} first_len=${first instanceof Uint8Array ? first.length : 'n/a'} first_hex_prefix=${getByteArrayPreview(first)}`
      );
      return;
    }

    const keys = result && typeof result === 'object' ? Object.keys(result) : [];
    log('info', `[MWA:sign] result_keys=${keys.length ? keys.join(',') : '(none)'}`);

    const candidates = [
      'signed_payloads',
      'signedPayloads',
      'signatures',
      'signed_messages',
      'payloads'
    ];

    candidates.forEach((key) => {
      const value = result?.[key];
      if (Array.isArray(value)) {
        const first = value[0];
        const firstLength =
          first instanceof Uint8Array
            ? first.length
            : typeof first === 'string'
              ? first.length
              : 'n/a';
        log('info', `[MWA:sign] field=${key} array_len=${value.length} first_len=${firstLength}`);
      } else if (value != null) {
        log('info', `[MWA:sign] field=${key} type=${typeof value}`);
      }
    });
  };

  const toUint8Array = (value) => {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    if (typeof value === 'string') {
      const bufferCtor = globalThis?.Buffer;
      if (!bufferCtor || typeof bufferCtor.from !== 'function') return null;
      try {
        return Uint8Array.from(bufferCtor.from(value, 'base64'));
      } catch (_error) {
        return null;
      }
    }
    return null;
  };

  const extractFirstSignedPayload = (result) => {
    if (Array.isArray(result)) {
      return toUint8Array(result[0]);
    }

    const arrays = [
      result?.signedPayloads,
      result?.signed_payloads,
      result?.signatures,
      result?.signed_messages,
      result?.payloads
    ];

    for (const value of arrays) {
      if (Array.isArray(value) && value.length > 0) {
        const first = toUint8Array(value[0]);
        if (first) return first;
      }
    }

    return null;
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
    const code = error?.code ?? 'UNKNOWN';
    log('error', `[MWA:${scope}] code=${code} message=${error?.message || String(error)}`);
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

      if (!(message instanceof Uint8Array)) {
        throw new SMWTError(
          ErrorCode.INVALID_MESSAGE,
          'Message must be Uint8Array bytes.'
        );
      }

      const signOnce = async ({ tokenForAuthorize }) => transact(async (wallet) => {
        let authResult;
        let authStep;

        if (tokenForAuthorize) {
          authStep = 'reauthorize';
          log('info', '[MWA:sign] auth_step=reauthorize');
          authResult = await wallet.reauthorize({
            auth_token: tokenForAuthorize,
            identity: appIdentity
          });
        } else {
          authStep = 'authorize';
          log('info', '[MWA:sign] auth_step=authorize');
          authResult = await wallet.authorize({
            chain,
            identity: appIdentity
          });
        }

        const activeSession = applyAuthorizationResult(authResult);
        const signingAddress = activeSession.accountAddress;
        log(
          'info',
          `[MWA:sign] Launching sign request (auth=${authStep} bytes=${message.length} address=${maskAddress(signingAddress)})`
        );

        // @solana-mobile/mobile-wallet-adapter-protocol-web3js expects object params with payloads[].
        const result = await wallet.signMessages({
          payloads: [message],
          addresses: [signingAddress]
        });

        log('info', '[MWA:sign] Returned from wallet');
        inspectSignResult(result);
        const signedPayload = extractFirstSignedPayload(result);
        if (!signedPayload || signedPayload.length === 0) {
          throw new SMWTError(
            ErrorCode.DEEPLINK_RETURN_FAILED,
            'Wallet did not return a signed payload.'
          );
        }

        return signedPayload;
      });

      const signStartedAt = Date.now();
      try {
        return await signOnce({ tokenForAuthorize: session.authToken });
      } catch (error) {
        logWalletError('sign', error);
        const durationMs = Date.now() - signStartedAt;

        if (isDeclinedError(error) && durationMs < FLOW_ABORTED_THRESHOLD_MS) {
          log('warn', '[MWA:sign] Result: FLOW_ABORTED (no approval UI shown)');
          throw normalizeProviderError(error, { flowAborted: true });
        }

        if (isAuthRelatedError(error)) {
          log('warn', 'Auth token rejected. Attempting a fresh authorize + one retry.');
          try {
            // Single retry with a fresh authorize().
            return await signOnce({ tokenForAuthorize: undefined });
          } catch (retryError) {
            logWalletError('sign-retry', retryError);
            const mappedRetryError = normalizeProviderError(retryError);
            log(
              'warn',
              `[MWA:sign] mapped_error=${mappedRetryError.code} reason=${mappedRetryError.message}`
            );
            throw mappedRetryError;
          }
        }

        const mappedError = normalizeProviderError(error);
        log(
          'warn',
          `[MWA:sign] mapped_error=${mappedError.code} reason=${mappedError.message}`
        );
        throw mappedError;
      }
    }
  };
}
