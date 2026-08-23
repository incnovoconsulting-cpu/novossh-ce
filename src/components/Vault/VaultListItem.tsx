import { FC } from 'react';
import styles from './VaultListItem.module.css';

interface VaultListItemProps {
  vault: any; // Vault
  isSelected: boolean;
  onSelect: () => void;
}

/**
 * VaultListItem: Individual vault card in sidebar
 *
 * Shows:
 * - Vault name
 * - Last modified timestamp
 * - Shared indicator
 * - Entry count
 */
export const VaultListItem: FC<VaultListItemProps> = ({
  vault,
  isSelected,
  onSelect,
}) => {
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'Unknown';
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return new Date(date).toLocaleDateString();
  };

  return (
    <button
      className={`${styles.container} ${isSelected ? styles.selected : ''}`}
      onClick={onSelect}
    >
      <div className={styles.icon}>🔐</div>
      <div className={styles.content}>
        <div className={styles.name}>{vault.name}</div>
        <div className={styles.meta}>
          {vault.isShared && <span className={styles.shared}>Shared</span>}
          <span className={styles.time}>{formatDate(vault.lastModifiedAt)}</span>
        </div>
      </div>
      {isSelected && <div className={styles.indicator}></div>}
    </button>
  );
};
