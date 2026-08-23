import { useState, FC } from 'react';
import { EntryListItem } from './EntryListItem';
import styles from './EntryList.module.css';

interface EntryListProps {
  entries: any[]; // VaultEntry[]
  vaultId: string;
  onDelete: (entryId: string) => Promise<void>;
  onUpdate: (entryId: string, updates: any) => Promise<void>;
  onDecrypt: (encryptedData: string) => Promise<string>;
}

/**
 * EntryList: Display entries in a vault
 *
 * Features:
 * - Shows all vault entries
 * - Organized by type (password, key, token, config)
 * - Search/filter capability
 * - Shows last modified time
 * - Empty state message
 * - Loading state
 */
export const EntryList: FC<EntryListProps> = ({
  entries,
  vaultId: _vaultId,
  onDelete,
  onUpdate,
  onDecrypt,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const filtered = entries.filter((entry) => {
    const matchesSearch = entry.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesType = !selectedType || entry.type === selectedType;
    return matchesSearch && matchesType;
  });

  const typeCount = (type: string) =>
    entries.filter((e) => e.type === type).length;

  const types = ['password', 'key', 'token', 'config'];

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <input
          type="text"
          className={styles.search}
          placeholder="Search entries..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className={styles.typeFilter}>
          <button
            className={`${styles.typeButton} ${!selectedType ? styles.active : ''}`}
            onClick={() => setSelectedType(null)}
          >
            All ({entries.length})
          </button>
          {types.map((type) => {
            const count = typeCount(type);
            if (count === 0) return null;
            return (
              <button
                key={type}
                className={`${styles.typeButton} ${selectedType === type ? styles.active : ''}`}
                onClick={() => setSelectedType(type)}
              >
                {type} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <p>
              {entries.length === 0
                ? 'No entries yet. Add one to get started.'
                : 'No entries match your search.'}
            </p>
          </div>
        ) : (
          filtered.map((entry) => (
            <EntryListItem
              key={entry.id}
              entry={entry}
              onDelete={() => onDelete(entry.id)}
              onUpdate={(updates) => onUpdate(entry.id, updates)}
              onDecrypt={onDecrypt}
            />
          ))
        )}
      </div>
    </div>
  );
};
