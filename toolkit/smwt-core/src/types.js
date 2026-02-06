/**
 * @typedef {Object} WalletSession
 * @property {string} publicKey
 * @property {string} walletName
 */

/**
 * @typedef {Object} WalletProvider
 * @property {string} name
 * @property {() => Promise<boolean>} isAvailable
 * @property {() => Promise<WalletSession>} connect
 * @property {() => Promise<void>} disconnect
 * @property {(message: Uint8Array) => Promise<Uint8Array>} signMessage
 */

export const Types = {};
