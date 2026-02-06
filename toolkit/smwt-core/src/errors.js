export const ErrorCode = {
  WALLET_NOT_INSTALLED: 'WALLET_NOT_INSTALLED',
  USER_CANCELLED: 'USER_CANCELLED',
  RETURN_FAILED: 'RETURN_FAILED',
  NOT_CONNECTED: 'NOT_CONNECTED',
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  INVALID_PROVIDER: 'INVALID_PROVIDER',
  PLATFORM_NOT_SUPPORTED: 'PLATFORM_NOT_SUPPORTED',
  UNKNOWN: 'UNKNOWN'
};

export class SMWTError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'SMWTError';
    this.code = code;
    this.cause = cause;
  }
}

export function normalizeProviderError(error) {
  if (error instanceof SMWTError) return error;
  const message = String(error && error.message ? error.message : error);
  const lower = message.toLowerCase();

  if (lower.includes('cancel') || lower.includes('rejected') || lower.includes('user')) {
    return new SMWTError(ErrorCode.USER_CANCELLED, message, error);
  }

  if (lower.includes('not installed') || lower.includes('no wallet') || lower.includes('no compatible')) {
    return new SMWTError(ErrorCode.WALLET_NOT_INSTALLED, message, error);
  }

  if (lower.includes('association') || lower.includes('timeout') || lower.includes('return')) {
    return new SMWTError(ErrorCode.RETURN_FAILED, message, error);
  }

  return new SMWTError(ErrorCode.UNKNOWN, message, error);
}
