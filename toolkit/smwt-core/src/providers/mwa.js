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
    chain = 'solana:devnet'
  } = options;

  let authToken = null;
  let session = null;

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
          const authorizationResult = await wallet.authorize({
            chain,
            identity: appIdentity,
            auth_token: authToken || undefined
          });

          if (!authorizationResult || !authorizationResult.accounts || authorizationResult.accounts.length === 0) {
            throw new SMWTError(
              ErrorCode.UNKNOWN,
              'Authorization succeeded but returned no accounts.'
            );
          }

          authToken = authorizationResult.auth_token || authToken;
          session = {
            publicKey: authorizationResult.accounts[0].address,
            walletName: authorizationResult.wallet_name || 'MWA Wallet'
          };

          return session;
        });
      } catch (error) {
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
        throw normalizeProviderError(error);
      } finally {
        authToken = null;
        session = null;
      }
    },

    async signMessage(message) {
      if (!session || !authToken) {
        throw new SMWTError(ErrorCode.NOT_CONNECTED, 'Wallet not connected.');
      }

      if (!(message instanceof Uint8Array)) {
        throw new SMWTError(ErrorCode.INVALID_MESSAGE, 'Message must be a Uint8Array.');
      }

      try {
        return await transact(async (wallet) => {
          const result = await wallet.signMessages({
            payloads: [message],
            addresses: [session.publicKey]
          });

          if (!result || !result.signed_payloads || result.signed_payloads.length === 0) {
            throw new SMWTError(
              ErrorCode.UNKNOWN,
              'Wallet did not return a signed payload.'
            );
          }

          return result.signed_payloads[0];
        });
      } catch (error) {
        throw normalizeProviderError(error);
      }
    }
  };
}
