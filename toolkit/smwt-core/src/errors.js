export const ErrorCode = {
  WALLET_NOT_INSTALLED: 'WALLET_NOT_INSTALLED',
  USER_DECLINED_APPROVAL: 'USER_DECLINED_APPROVAL',
  AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  TIMEOUT: 'TIMEOUT',
  DEEPLINK_RETURN_FAILED: 'DEEPLINK_RETURN_FAILED',
  USER_CANCELLED: 'USER_DECLINED_APPROVAL',
  RETURN_FAILED: 'DEEPLINK_RETURN_FAILED',
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
  const code = Number(error?.code);

  if (
    lower.includes('auth token not valid for signing') ||
    lower.includes('auth_token not valid for signing') ||
    lower.includes('invalid auth token')
  ) {
    return new SMWTError(
      ErrorCode.AUTH_TOKEN_INVALID,
      'Wallet session token is no longer valid. Reconnect and try again.',
      error
    );
  }

  if (
    lower.includes('authorization') ||
    lower.includes('authorize failed') ||
    lower.includes('not authorized')
  ) {
    return new SMWTError(
      ErrorCode.AUTHORIZATION_FAILED,
      'Wallet authorization failed. Reconnect and try again.',
      error
    );
  }

  if (
    lower.includes('timeout') ||
    lower.includes('timed out')
  ) {
    return new SMWTError(
      ErrorCode.TIMEOUT,
      'Wallet request timed out. Retry the operation.',
      error
    );
  }

  if (code === -1) {
    return new SMWTError(
      ErrorCode.AUTHORIZATION_FAILED,
      'Wallet authorization failed. Reconnect and try again.',
      error
    );
  }

  if (lower.includes('not installed') || lower.includes('no wallet') || lower.includes('no compatible')) {
    return new SMWTError(
      ErrorCode.WALLET_NOT_INSTALLED,
      'No compatible wallet detected on this device.',
      error
    );
  }

  if (lower.includes('association') || lower.includes('return') || lower.includes('deeplink')) {
    return new SMWTError(
      ErrorCode.DEEPLINK_RETURN_FAILED,
      'Wallet did not return to the app correctly. Please try again.',
      error
    );
  }

  if (
    code === -3 ||
    lower.includes('declined') ||
    lower.includes('rejected') ||
    lower.includes('user cancelled') ||
    lower.includes('user canceled') ||
    lower.includes('request declined')
  ) {
    return new SMWTError(
      ErrorCode.USER_DECLINED_APPROVAL,
      'Signing was declined in Phantom.',
      error
    );
  }

  return new SMWTError(ErrorCode.UNKNOWN, message, error);
}
