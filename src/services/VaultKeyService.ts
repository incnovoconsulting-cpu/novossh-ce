import sodium from 'libsodium-wrappers-sumo';
import { EncryptionService, type KDFParameters } from './EncryptionService';

export interface VaultKeyBundle {
  publicKey: string; // base64
  encryptedPrivateKey: string; // base64
  privateKeyNonce: string; // base64
  kdfSalt: string; // base64
  kdfParams: KDFParameters;
}

/**
 * Manages the per-user X25519 keypair used to seal/unseal vault DEKs, and the
 * per-vault DEK used to encrypt/decrypt entries. Private keys and DEKs only
 * ever exist in plaintext in memory on the client.
 */
export class VaultKeyService {
  /**
   * Generate a new keypair and encrypt the private key with a key derived
   * from the vault master password. Called once per user (key setup).
   */
  static async createKeyBundle(vaultMasterPassword: string): Promise<VaultKeyBundle> {
    await sodium.ready;

    const { publicKey, privateKey } = sodium.crypto_box_keypair();
    const { key, salt } = await EncryptionService.deriveKey(vaultMasterPassword);
    const encrypted = await EncryptionService.encrypt(
      sodium.to_base64(privateKey, sodium.base64_variants.ORIGINAL),
      key
    );

    return {
      publicKey: sodium.to_base64(publicKey, sodium.base64_variants.ORIGINAL),
      encryptedPrivateKey: encrypted.ciphertext,
      privateKeyNonce: encrypted.nonce,
      kdfSalt: salt,
      kdfParams: EncryptionService.RECOMMENDED_KDF_PARAMS,
    };
  }

  /**
   * Unlock: derive the key from the vault master password + stored salt,
   * decrypt the private key. Throws if the password is wrong.
   */
  static async unlockPrivateKey(
    vaultMasterPassword: string,
    bundle: Pick<VaultKeyBundle, 'encryptedPrivateKey' | 'privateKeyNonce' | 'kdfSalt' | 'kdfParams'>
  ): Promise<Uint8Array> {
    await sodium.ready;
    const { key } = await EncryptionService.deriveKey(vaultMasterPassword, bundle.kdfSalt, bundle.kdfParams);
    const decrypted = await EncryptionService.decrypt(
      { ciphertext: bundle.encryptedPrivateKey, nonce: bundle.privateKeyNonce },
      key
    );
    return sodium.from_base64(decrypted, sodium.base64_variants.ORIGINAL);
  }

  /** Generate a fresh random vault DEK (32 bytes). */
  static async generateDek(): Promise<Uint8Array> {
    await sodium.ready;
    return sodium.randombytes_buf(32);
  }

  /** Seal a DEK for a recipient's public key (anonymous sealed box). */
  static async wrapDek(dek: Uint8Array, recipientPublicKey: string): Promise<string> {
    await sodium.ready;
    const pubKeyBytes = sodium.from_base64(recipientPublicKey, sodium.base64_variants.ORIGINAL);
    const sealed = sodium.crypto_box_seal(dek, pubKeyBytes);
    return sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL);
  }

  /** Unseal a DEK using the holder's own keypair. */
  static async unwrapDek(
    wrappedDek: string,
    publicKey: Uint8Array,
    privateKey: Uint8Array
  ): Promise<Uint8Array> {
    await sodium.ready;
    const sealedBytes = sodium.from_base64(wrappedDek, sodium.base64_variants.ORIGINAL);
    const dek = sodium.crypto_box_seal_open(sealedBytes, publicKey, privateKey);
    if (!dek) throw new Error('Failed to unwrap vault key: invalid key or corrupted data');
    return dek;
  }

  static publicKeyFromPrivate(privateKey: Uint8Array): Uint8Array {
    return sodium.crypto_scalarmult_base(privateKey);
  }

  /** Encrypt a vault entry's plaintext JSON payload with the vault DEK. */
  static async encryptEntry(plaintext: string, dek: Uint8Array): Promise<string> {
    const encrypted = await EncryptionService.encrypt(plaintext, dek);
    return JSON.stringify(encrypted);
  }

  /** Decrypt a vault entry's encrypted_data field with the vault DEK. */
  static async decryptEntry(encryptedData: string, dek: Uint8Array): Promise<string> {
    const parsed = JSON.parse(encryptedData);
    return EncryptionService.decrypt(parsed, dek);
  }
}
