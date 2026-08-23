import sodium from 'libsodium-wrappers-sumo';

/**
 * Encryption parameters for XChaCha20-Poly1305
 */
export interface EncryptedData {
  ciphertext: string; // Base64(ciphertext || tag)
  nonce: string; // Base64 encoded nonce
  aad?: string; // Additional Authenticated Data (optional)
}

/**
 * Key derivation parameters (Argon2id)
 */
export interface KDFParameters {
  iterations: number;
  memory: number; // In MB
  parallelism: number;
}

/**
 * EncryptionService: Handles E2E encryption/decryption using XChaCha20-Poly1305
 * and key derivation using Argon2id.
 *
 * All operations are performed client-side with no keys transmitted or stored server-side.
 */
export class EncryptionService {
  private static readonly NONCE_LENGTH = 24; // 24 bytes for XChaCha20
  private static readonly SALT_LENGTH = 16; // 16 bytes for Argon2id
  private static readonly KEY_LENGTH = 32; // 256-bit key

  /**
   * Recommended KDF parameters for Argon2id
   * These are conservative parameters suitable for user password hashing
   */
  static readonly RECOMMENDED_KDF_PARAMS: KDFParameters = {
    iterations: 4, // Minimum recommended for password hashing
    memory: 64, // 64 MB (conservative for browser)
    parallelism: 1, // Single-threaded (safest)
  };

  /**
   * Derive a master key from a password using Argon2id
   *
   * @param password User's password
   * @param salt Base64-encoded salt (or undefined to generate new)
   * @param params Key derivation parameters
   * @returns Promise<{ key, salt }>
   */
  static async deriveKey(
    password: string,
    salt?: string,
    params: KDFParameters = this.RECOMMENDED_KDF_PARAMS
  ): Promise<{ key: Uint8Array; salt: string }> {
    // Initialize libsodium if needed
    await sodium.ready;

    // Generate or decode salt
    let saltBytes: Uint8Array;
    if (!salt) {
      saltBytes = sodium.randombytes_buf(this.SALT_LENGTH);
    } else {
      saltBytes = sodium.from_base64(salt, sodium.base64_variants.ORIGINAL);
    }

    // Derive key using Argon2id
    const keyBytes = sodium.crypto_pwhash(
      this.KEY_LENGTH,
      password,
      saltBytes,
      params.iterations,
      params.memory * 1024, // Convert MB to KB
      sodium.crypto_pwhash_ALG_ARGON2ID13
    );

    return {
      key: keyBytes,
      salt: sodium.to_base64(saltBytes, sodium.base64_variants.ORIGINAL),
    };
  }

  /**
   * Encrypt plaintext using XChaCha20-Poly1305
   *
   * @param plaintext Data to encrypt
   * @param key 32-byte encryption key
   * @param aad Optional additional authenticated data
   * @returns Encrypted data with nonce
   */
  static async encrypt(
    plaintext: string,
    key: Uint8Array,
    aad?: string
  ): Promise<EncryptedData> {
    await sodium.ready;

    // Validate key size
    if (key.length !== this.KEY_LENGTH) {
      throw new Error(
        `Invalid key length: expected ${this.KEY_LENGTH}, got ${key.length}`
      );
    }

    // Generate random nonce
    const nonce = sodium.randombytes_buf(this.NONCE_LENGTH);

    // Prepare plaintext as bytes
    const plaintextBytes = new TextEncoder().encode(plaintext);

    // Prepare AAD if provided
    const aadBytes = aad ? new TextEncoder().encode(aad) : undefined;

    // Encrypt using XChaCha20-Poly1305
    const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      plaintextBytes,
      aadBytes || null,
      null, // nsec (always null for this algorithm)
      nonce,
      key
    );

    return {
      ciphertext: sodium.to_base64(ciphertext, sodium.base64_variants.ORIGINAL),
      nonce: sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL),
      aad: aad,
    };
  }

  /**
   * Decrypt ciphertext using XChaCha20-Poly1305
   *
   * @param encrypted Encrypted data with nonce
   * @param key 32-byte decryption key
   * @returns Decrypted plaintext
   * @throws Error if decryption fails or AAD doesn't match
   */
  static async decrypt(
    encrypted: EncryptedData,
    key: Uint8Array
  ): Promise<string> {
    await sodium.ready;

    // Validate key size
    if (key.length !== this.KEY_LENGTH) {
      throw new Error(
        `Invalid key length: expected ${this.KEY_LENGTH}, got ${key.length}`
      );
    }

    // Decode ciphertext and nonce from base64
    const ciphertextBytes = sodium.from_base64(encrypted.ciphertext, sodium.base64_variants.ORIGINAL);
    const nonceBytes = sodium.from_base64(encrypted.nonce, sodium.base64_variants.ORIGINAL);

    // Validate nonce size
    if (nonceBytes.length !== this.NONCE_LENGTH) {
      throw new Error(
        `Invalid nonce length: expected ${this.NONCE_LENGTH}, got ${nonceBytes.length}`
      );
    }

    // Prepare AAD if provided
    const aadBytes = encrypted.aad
      ? new TextEncoder().encode(encrypted.aad)
      : undefined;

    try {
      // Decrypt using XChaCha20-Poly1305
      const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null, // nsec
        ciphertextBytes,
        aadBytes || null,
        nonceBytes,
        key
      );

      return new TextDecoder().decode(plaintext);
    } catch (_error) {
      throw new Error('Decryption failed: Invalid key or corrupted data');
    }
  }

  /**
   * Generate a random nonce
   * @returns Base64-encoded nonce
   */
  static async generateNonce(): Promise<string> {
    await sodium.ready;
    return sodium.to_base64(sodium.randombytes_buf(this.NONCE_LENGTH), sodium.base64_variants.ORIGINAL);
  }

  /**
   * Generate a random salt
   * @returns Base64-encoded salt
   */
  static async generateSalt(): Promise<string> {
    await sodium.ready;
    return sodium.to_base64(sodium.randombytes_buf(this.SALT_LENGTH), sodium.base64_variants.ORIGINAL);
  }

  /**
   * Hash a password for verification (not key derivation)
   * Used for password storage/verification in database
   *
   * @param password Password to hash
   * @returns Base64-encoded hash
   */
  static async hashPassword(password: string): Promise<string> {
    await sodium.ready;

    const hash = sodium.crypto_pwhash_str(
      password,
      sodium.crypto_pwhash_OPSLIMIT_SENSITIVE,
      sodium.crypto_pwhash_MEMLIMIT_SENSITIVE
    );

    return hash;
  }

  /**
   * Verify a password against a hash
   *
   * @param password Password to verify
   * @param hash Previously stored hash
   * @returns True if password matches
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    await sodium.ready;

    try {
      return sodium.crypto_pwhash_str_verify(hash, password);
    } catch {
      return false;
    }
  }
}
