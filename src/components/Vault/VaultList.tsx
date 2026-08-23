import { FC } from 'react';
import { VaultListItem } from './VaultListItem';
import styles from './VaultList.module.css';

interface VaultListProps {
  vaults: any[]; // Vault[]
  selectedVaultId: string | null;
  onSelectVault: (vaultId: string) => void;
  loading: boolean;
}

/**
 * VaultList: Display list of user's vaults
 *
 * Features:
 * - Shows all accessible vaults
 * - Highlights selected vault
 * - Shows vault metadata (name, owner, last modified)
 * - Indicates shared vaults
 * - Loading state
 * - Empty state message
 */
export const VaultList: FC<VaultListProps> = ({
  vaults,
  selectedVaultId,
  onSelectVault,
  loading,
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Vaults</h2>
        <span className={styles.count}>{vaults.length}</span>
      </div>

      <div className={styles.list}>
        {loading ? (
          <div className={styles.loading}>
            <p>Loading vaults...</p>
          </div>
        ) : vaults.length === 0 ? (
          <div className={styles.empty}>
            <p>No vaults yet</p>
            <small>Create a new vault to get started</small>
          </div>
        ) : (
          vaults.map((vault) => (
            <VaultListItem
              key={vault.id}
              vault={vault}
              isSelected={vault.id === selectedVaultId}
              onSelect={() => onSelectVault(vault.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};
