import { useState, FC, FormEvent } from 'react';
import styles from './CreateVaultDialog.module.css';

interface CreateVaultDialogProps {
  onCreate: (name: string, description?: string) => Promise<void>;
  onClose: () => void;
}

/**
 * CreateVaultDialog: Modal for creating a new vault
 */
export const CreateVaultDialog: FC<CreateVaultDialogProps> = ({
  onCreate,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Vault name is required');
      return;
    }

    setLoading(true);
    try {
      await onCreate(name, description || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vault');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h2>Create New Vault</h2>
          <button className={styles.close} onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="name">Vault Name *</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production Credentials"
              autoFocus
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="description">Description (optional)</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details about this vault..."
              rows={3}
            />
          </div>

          <div className={styles.info}>
            <p>🔐 All data will be encrypted end-to-end with your password.</p>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.submit} disabled={loading}>
              {loading ? 'Creating...' : 'Create Vault'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
