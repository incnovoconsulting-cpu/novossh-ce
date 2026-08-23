import { useState, useCallback, useEffect } from 'react';
import { EncryptionService, type EncryptedData, type KDFParameters } from '../services/EncryptionService';

interface UseEncryptionState {
  isReady: boolean;
  error: Error | null;
  derivedKey: Uint8Array | null;
}

interface UseEncryptionMethods {
  // Key derivation
  deriveKey: (password: string, salt?: string, params?: KDFParameters) => Promise<{ key: Uint8Array; salt: string }>;

  // Encryption
  encrypt: (plaintext: string, key: Uint8Array, aad?: string) => Promise<EncryptedData>;
  decrypt: (encrypted: EncryptedData, key: Uint8Array) => Promise<string>;

  // Utilities
  generateNonce: () => Promise<string>;
  generateSalt: () => Promise<string>;

  // Password
  hashPassword: (password: string) => Promise<string>;
  verifyPassword: (password: string, hash: string) => Promise<boolean>;
}

/**
 * Custom hook for encryption/decryption operations
 *
 * Usage:
 * const { encrypt, decrypt, deriveKey } = useEncryption();
 * const { key, salt } = await deriveKey('password');
 * const encrypted = await encrypt('secret data', key);
 * const decrypted = await decrypt(encrypted, key);
 */
export function useEncryption(): UseEncryptionState & UseEncryptionMethods {
  const [state, setState] = useState<UseEncryptionState>({
    isReady: false,
    error: null,
    derivedKey: null,
  });

  // Initialize libsodium on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        // Trigger libsodium initialization
        await EncryptionService.generateNonce();
        setState((prev) => ({
          ...prev,
          isReady: true,
          error: null,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error : new Error('Failed to initialize encryption'),
          isReady: false,
        }));
      }
    };

    initialize();
  }, []);

  const deriveKey = useCallback(
    async (
      password: string,
      salt?: string,
      params?: KDFParameters
    ) => {
      try {
        const result = await EncryptionService.deriveKey(password, salt, params);
        setState((prev) => ({
          ...prev,
          derivedKey: result.key,
          error: null,
        }));
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Key derivation failed');
        setState((prev) => ({ ...prev, error: err }));
        throw err;
      }
    },
    []
  );

  const encrypt = useCallback(
    async (plaintext: string, key: Uint8Array, aad?: string) => {
      try {
        return await EncryptionService.encrypt(plaintext, key, aad);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Encryption failed');
        setState((prev) => ({ ...prev, error: err }));
        throw err;
      }
    },
    []
  );

  const decrypt = useCallback(
    async (encrypted: EncryptedData, key: Uint8Array) => {
      try {
        return await EncryptionService.decrypt(encrypted, key);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Decryption failed');
        setState((prev) => ({ ...prev, error: err }));
        throw err;
      }
    },
    []
  );

  const generateNonce = useCallback(async () => {
    try {
      return await EncryptionService.generateNonce();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to generate nonce');
      setState((prev) => ({ ...prev, error: err }));
      throw err;
    }
  }, []);

  const generateSalt = useCallback(async () => {
    try {
      return await EncryptionService.generateSalt();
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to generate salt');
      setState((prev) => ({ ...prev, error: err }));
      throw err;
    }
  }, []);

  const hashPassword = useCallback(async (password: string) => {
    try {
      return await EncryptionService.hashPassword(password);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Password hashing failed');
      setState((prev) => ({ ...prev, error: err }));
      throw err;
    }
  }, []);

  const verifyPassword = useCallback(async (password: string, hash: string) => {
    try {
      return await EncryptionService.verifyPassword(password, hash);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Password verification failed');
      setState((prev) => ({ ...prev, error: err }));
      return false;
    }
  }, []);

  return {
    ...state,
    deriveKey,
    encrypt,
    decrypt,
    generateNonce,
    generateSalt,
    hashPassword,
    verifyPassword,
  };
}
