import { createContext, useCallback, useContext, useEffect, useRef, useState, FC, ReactNode } from 'react';
import sodium from 'libsodium-wrappers-sumo';
import { VaultKeyService } from '../services/VaultKeyService';
import {
  getMyVaultKey,
  registerVaultKey,
  getWrappedDekForVault,
  setOwnerWrappedDek as apiSetOwnerWrappedDek,
} from '../lib/vaultApi';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

interface VaultKeyState {
  hasKeyRegistered: boolean | null; // null = unknown yet
  isUnlocked: boolean;
  loading: boolean;
  error: Error | null;
}

interface VaultKeyMethods {
  setUpKey: (vaultMasterPassword: string) => Promise<void>;
  unlock: (vaultMasterPassword: string) => Promise<void>;
  lock: () => void;
  /** Returns the unlocked DEK for a vault, unwrapping (and caching) it if needed. */
  getVaultDek: (vaultId: string) => Promise<Uint8Array>;
  /** Generates a fresh DEK for a brand-new vault, wraps it for the owner, persists the wrap. */
  createVaultDek: (vaultId: string) => Promise<Uint8Array>;
  encryptForVault: (vaultId: string, plaintext: string) => Promise<string>;
  decryptForVault: (vaultId: string, encryptedData: string) => Promise<string>;
}

const VaultKeyContext = createContext<(VaultKeyState & VaultKeyMethods) | null>(null);

export const VaultKeyProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<VaultKeyState>({
    hasKeyRegistered: null,
    isUnlocked: false,
    loading: false,
    error: null,
  });

  // In-memory only — never persisted.
  const privateKeyRef = useRef<Uint8Array | null>(null);
  const publicKeyRef = useRef<Uint8Array | null>(null);
  const dekCacheRef = useRef<Map<string, Uint8Array>>(new Map());
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(() => {
    privateKeyRef.current = null;
    publicKeyRef.current = null;
    dekCacheRef.current.clear();
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setState((prev) => ({ ...prev, isUnlocked: false }));
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(lock, IDLE_TIMEOUT_MS);
  }, [lock]);

  useEffect(() => {
    (async () => {
      try {
        const key = await getMyVaultKey();
        setState((prev) => ({ ...prev, hasKeyRegistered: !!key }));
      } catch {
        setState((prev) => ({ ...prev, hasKeyRegistered: false }));
      }
    })();
  }, []);

  // Reset idle timer on user activity while unlocked.
  useEffect(() => {
    if (!state.isUnlocked) return;
    const events = ['mousedown', 'keydown', 'touchstart'];
    const handler = () => resetIdleTimer();
    events.forEach((e) => window.addEventListener(e, handler));
    resetIdleTimer();
    return () => events.forEach((e) => window.removeEventListener(e, handler));
  }, [state.isUnlocked, resetIdleTimer]);

  useEffect(() => {
    const handleUnload = () => lock();
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [lock]);

  const setUpKey = useCallback(async (vaultMasterPassword: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const bundle = await VaultKeyService.createKeyBundle(vaultMasterPassword);
      await registerVaultKey(bundle);
      privateKeyRef.current = await VaultKeyService.unlockPrivateKey(vaultMasterPassword, bundle);
      await sodium.ready;
      publicKeyRef.current = sodium.from_base64(bundle.publicKey, sodium.base64_variants.ORIGINAL);
      setState((prev) => ({ ...prev, hasKeyRegistered: true, isUnlocked: true, loading: false }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Key setup failed');
      setState((prev) => ({ ...prev, error: err, loading: false }));
      throw err;
    }
  }, []);

  const unlock = useCallback(async (vaultMasterPassword: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const bundle = await getMyVaultKey();
      if (!bundle) throw new Error('No vault key registered for this account');
      privateKeyRef.current = await VaultKeyService.unlockPrivateKey(vaultMasterPassword, {
        encryptedPrivateKey: bundle.encrypted_private_key,
        privateKeyNonce: bundle.private_key_nonce,
        kdfSalt: bundle.kdf_salt,
        kdfParams: bundle.kdf_params,
      });
      await sodium.ready;
      publicKeyRef.current = sodium.from_base64(bundle.public_key, sodium.base64_variants.ORIGINAL);
      setState((prev) => ({ ...prev, isUnlocked: true, loading: false }));
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unlock failed');
      setState((prev) => ({ ...prev, error: err, loading: false }));
      throw err;
    }
  }, []);

  const getVaultDek = useCallback(async (vaultId: string): Promise<Uint8Array> => {
    const cached = dekCacheRef.current.get(vaultId);
    if (cached) return cached;
    if (!privateKeyRef.current || !publicKeyRef.current) {
      throw new Error('Vault is locked');
    }
    const wrap = await getWrappedDekForVault(vaultId);
    if (!wrap) throw new Error('No key available for this vault');
    const dek = await VaultKeyService.unwrapDek(wrap.wrappedDek, publicKeyRef.current, privateKeyRef.current);
    dekCacheRef.current.set(vaultId, dek);
    return dek;
  }, []);

  const createVaultDek = useCallback(async (vaultId: string): Promise<Uint8Array> => {
    if (!publicKeyRef.current) throw new Error('Vault is locked');
    const dek = await VaultKeyService.generateDek();
    await sodium.ready;
    const wrapped = await VaultKeyService.wrapDek(dek, sodium.to_base64(publicKeyRef.current, sodium.base64_variants.ORIGINAL));
    await apiSetOwnerWrappedDek(vaultId, wrapped);
    dekCacheRef.current.set(vaultId, dek);
    return dek;
  }, []);

  const encryptForVault = useCallback(async (vaultId: string, plaintext: string) => {
    const dek = await getVaultDek(vaultId);
    return VaultKeyService.encryptEntry(plaintext, dek);
  }, [getVaultDek]);

  const decryptForVault = useCallback(async (vaultId: string, encryptedData: string) => {
    const dek = await getVaultDek(vaultId);
    return VaultKeyService.decryptEntry(encryptedData, dek);
  }, [getVaultDek]);

  return (
    <VaultKeyContext.Provider
      value={{ ...state, setUpKey, unlock, lock, getVaultDek, createVaultDek, encryptForVault, decryptForVault }}
    >
      {children}
    </VaultKeyContext.Provider>
  );
};

export function useVaultKey() {
  const ctx = useContext(VaultKeyContext);
  if (!ctx) throw new Error('useVaultKey must be used within a VaultKeyProvider');
  return ctx;
}
