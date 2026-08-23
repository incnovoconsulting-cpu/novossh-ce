import { useState, useRef, FC } from 'react';
import styles from './EntryListItem.module.css';
import { useStore } from '../../lib/store';
import { createSession } from '../../lib/sessionsApi';

interface EntryListItemProps {
  entry: any; // VaultEntry
  onDelete: () => Promise<void>;
  onUpdate: (updates: any) => Promise<void>;
  onDecrypt: (encryptedData: string) => Promise<string>;
}

/**
 * EntryListItem: Individual entry card in list
 *
 * Shows:
 * - Entry name (decrypted label)
 * - Entry type (password, key, token, config)
 * - Last modified time
 * - Copy/reveal/edit/delete actions
 */
export const EntryListItem: FC<EntryListItemProps> = ({
  entry,
  onDelete,
  onUpdate,
  onDecrypt,
}) => {
  const openTab = useStore((s) => s.openTab);
  const setView = useStore((s) => s.setView);

  const [showActions, setShowActions] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(entry.name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const typeIcons: Record<string, string> = {
    ssh: '🖥️',
    password: '🔑',
    key: '🗝️',
    token: '🎟️',
    config: '⚙️',
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;

    return new Date(date).toLocaleDateString();
  };

  const handleCopy = async () => {
    try {
      const plaintext = await onDecrypt(entry.encryptedData);
      await navigator.clipboard.writeText(plaintext);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to decrypt/copy:', error);
    }
  };

  const handleEditStart = () => {
    setEditName(entry.name);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleEditSave = async () => {
    const name = editName.trim();
    if (!name || name === entry.name) { setIsEditing(false); return; }
    setSaving(true);
    try {
      await onUpdate({ name });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update entry:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const plaintext = await onDecrypt(entry.encryptedData);
      const params = JSON.parse(plaintext);

      let sessionId: string | undefined;
      try {
        const session = await createSession(entry.vault_id, `Connect: ${entry.name}`);
        sessionId = session.id;
      } catch (sessionError) {
        console.error('Failed to create recorded session, connecting without recording:', sessionError);
      }

      openTab(undefined, {
        host: params.host,
        port: params.port ?? 22,
        username: params.username,
        password: params.password,
        privateKey: params.privateKey,
        passphrase: params.passphrase,
        vaultId: entry.vault_id,
        sessionId,
      });
      setView('hosts');
    } catch (error) {
      console.error('Failed to connect from vault:', error);
    } finally {
      setConnecting(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(`Delete "${entry.name}"?`)) {
      setDeleting(true);
      try {
        await onDelete();
      } catch (error) {
        console.error('Failed to delete entry:', error);
      } finally {
        setDeleting(false);
      }
    }
  };

  return (
    <div
      className={styles.container}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={styles.icon}>{typeIcons[entry.type]}</div>

      <div className={styles.content}>
        <div className={styles.name}>
          {isEditing ? (
            <input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEditSave();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              disabled={saving}
              className={styles.editInput}
              autoFocus
            />
          ) : entry.name}
        </div>
        <div className={styles.meta}>
          <span className={styles.type}>{entry.type}</span>
          <span className={styles.time}>{formatDate(entry.updatedAt)}</span>
        </div>
      </div>

      {showActions && (
        <div className={styles.actions}>
          {entry.type === 'ssh' && (
            <button
              className={`${styles.actionButton} ${styles.connect}`}
              onClick={handleConnect}
              disabled={connecting}
              title="Open terminal"
            >
              {connecting ? '...' : '⚡ Connect'}
            </button>
          )}
          <button
            className={styles.actionButton}
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            {isCopied ? '✓' : '📋'}
          </button>
          <button
            className={styles.actionButton}
            onClick={handleEditStart}
            title="Edit entry"
            disabled={saving}
          >
            ✎
          </button>
          <button
            className={`${styles.actionButton} ${styles.delete}`}
            onClick={handleDelete}
            disabled={deleting}
            title="Delete entry"
          >
            {deleting ? '...' : '🗑️'}
          </button>
        </div>
      )}
    </div>
  );
};
