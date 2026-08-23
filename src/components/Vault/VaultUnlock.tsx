import { useState, FC, FormEvent } from 'react';
import { useVaultKey } from '../../contexts/VaultKeyContext';
import { useStore } from '../../lib/store';
import styles from './VaultUnlock.module.css';

/**
 * Blocks vault access until the user has set up (first time) or unlocked
 * (every session) their vault master password. The derived key/private key
 * never leave the client and are held only in memory.
 */
export const VaultUnlock: FC<{ children: React.ReactNode }> = ({ children }) => {
  const { hasKeyRegistered, isUnlocked, loading, setUpKey, unlock } = useVaultKey();
  const setView = useStore((s) => s.setView);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (hasKeyRegistered === null) return null; // still checking
  if (isUnlocked) return <>{children}</>;

  const isSetup = hasKeyRegistered === false;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isSetup) {
      if (password.length < 12) {
        setError('Vault master password must be at least 12 characters');
        return;
      }
      if (password !== confirm) {
        setError('Passwords do not match');
        return;
      }
    }

    try {
      if (isSetup) {
        await setUpKey(password);
      } else {
        await unlock(password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setPassword('');
      setConfirm('');
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <button
          type="button"
          className={styles.close}
          aria-label="Close"
          onClick={() => setView('hosts')}
        >
          ✕
        </button>
        <h2>{isSetup ? 'Set up your vault' : 'Unlock your vault'}</h2>
        <p className={styles.hint}>
          {isSetup
            ? 'This password encrypts your vault keys. It is never sent to the server and cannot be recovered if lost — store it safely.'
            : 'Enter your vault master password to decrypt your vault keys for this session.'}
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Vault master password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {isSetup && (
            <input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          )}
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.actions}>
            <button type="submit" className={styles.submit} disabled={loading || !password}>
              {loading ? 'Working...' : isSetup ? 'Create' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
