import { ErrorCode, SMWTError } from './errors.js';
import { createMwaProvider } from './providers/mwa.js';

export function createToolkit({ provider, logger } = {}) {
  if (!provider) {
    throw new SMWTError(ErrorCode.INVALID_PROVIDER, 'Provider is required.');
  }

  let session = null;
  const maskToken = (token) => (token ? `***${String(token).slice(-6)}` : '(none)');
  const sanitizeSessionForLog = (value) => {
    if (!value || typeof value !== 'object') return value;
    return {
      ...value,
      authToken: maskToken(value.authToken)
    };
  };

  const log = (level, message, meta) => {
    if (!logger) return;
    if (typeof logger[level] === 'function') {
      logger[level](message, meta);
    } else if (typeof logger.log === 'function') {
      logger.log(message, meta);
    }
  };

  return {
    async connect() {
      log('info', 'Checking wallet availability.');
      const available = await provider.isAvailable();
      if (!available) {
        throw new SMWTError(
          ErrorCode.WALLET_NOT_INSTALLED,
          'No compatible wallet detected on this device.'
        );
      }
      log('info', 'Requesting wallet connection.');
      session = await provider.connect();
      log('info', 'Wallet connected.', sanitizeSessionForLog(session));
      return session;
    },

    async disconnect() {
      log('info', 'Disconnecting wallet.');
      await provider.disconnect();
      session = null;
      log('info', 'Wallet disconnected.');
    },

    async signMessage(message) {
      log('info', 'Requesting message signature.');
      const signature = await provider.signMessage(message);
      log('info', 'Message signed.');
      return signature;
    },

    getSession() {
      return session;
    }
  };
}

export { createMwaProvider };
export { ErrorCode, SMWTError } from './errors.js';
export { Types } from './types.js';
