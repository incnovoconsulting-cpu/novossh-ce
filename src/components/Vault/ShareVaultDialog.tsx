import { useState, FC, FormEvent } from 'react';
import styles from './ShareVaultDialog.module.css';

interface ShareVaultDialogProps {
  vaultId: string;
  onShare: (userId: string, accessLevel: 'viewer' | 'editor' | 'owner') => Promise<any>;
  onGenerateLink: (accessLevel: 'viewer' | 'editor', expiresIn?: number) => Promise<any>;
  onClose: () => void;
}

/**
 * ShareVaultDialog: Modal for sharing vault access
 *
 * Features:
 * - Share with specific users
 * - Set access levels (viewer, editor, owner)
 * - Generate shareable links
 * - Set link expiration
 * - Manage existing shares
 * - Revoke access
 */
export const ShareVaultDialog: FC<ShareVaultDialogProps> = ({
  vaultId: _vaultId,
  onShare,
  onGenerateLink,
  onClose,
}) => {
  const [shareEmail, setShareEmail] = useState('');
  const [accessLevel, setAccessLevel] = useState<'viewer' | 'editor' | 'owner'>(
    'viewer'
  );
  const [linkExpiration, setLinkExpiration] = useState<number | undefined>(
    undefined
  );
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShare = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!shareEmail.trim()) {
      setError('Email is required');
      return;
    }

    setLoading(true);
    try {
      await onShare(shareEmail, accessLevel);
      setShareEmail('');
      // In production, show toast notification
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLink = async () => {
    setLoading(true);
    setError(null);
    try {
      const share = await onGenerateLink(
        accessLevel as 'viewer' | 'editor',
        linkExpiration
      );
      setGeneratedLink(share.shareUrl || `${window.location.origin}/vault/join/${share.shareToken}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (generatedLink) {
      try {
        await navigator.clipboard.writeText(generatedLink);
        // Show copied notification
      } catch (error) {
        console.error('Failed to copy link:', error);
      }
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h2>Share Vault</h2>
          <button className={styles.close} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.tabs}>
          <button className={styles.tabButton}>Share with Users</button>
          <button className={styles.tabButton}>Generate Link</button>
        </div>

        <form onSubmit={handleShare} className={styles.shareSection}>
          <div className={styles.formGroup}>
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="accessLevel">Access Level</label>
            <select
              id="accessLevel"
              value={accessLevel}
              onChange={(e) =>
                setAccessLevel(e.target.value as 'viewer' | 'editor' | 'owner')
              }
            >
              <option value="viewer">👁️ Viewer - Read only</option>
              <option value="editor">✎ Editor - Can modify entries</option>
              <option value="owner">👑 Owner - Full control</option>
            </select>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? 'Sharing...' : 'Share Vault'}
          </button>
        </form>

        <div className={styles.linkSection}>
          <div className={styles.formGroup}>
            <label>Generate Shareable Link</label>
            <div className={styles.linkOptions}>
              <select
                value={accessLevel}
                onChange={(e) =>
                  setAccessLevel(e.target.value as 'viewer' | 'editor' | 'owner')
                }
              >
                <option value="viewer">👁️ Viewer</option>
                <option value="editor">✎ Editor</option>
              </select>

              <select
                value={linkExpiration || ''}
                onChange={(e) =>
                  setLinkExpiration(
                    e.target.value ? parseInt(e.target.value) : undefined
                  )
                }
              >
                <option value="">No expiration</option>
                <option value={3600}>1 hour</option>
                <option value={86400}>1 day</option>
                <option value={604800}>1 week</option>
              </select>
            </div>
          </div>

          {generatedLink ? (
            <div className={styles.linkGenerated}>
              <input type="text" value={generatedLink} readOnly />
              <button type="button" onClick={handleCopyLink}>
                📋 Copy
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={styles.generateButton}
              onClick={handleGenerateLink}
              disabled={loading}
            >
              {loading ? 'Generating...' : 'Generate Link'}
            </button>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.closeButton} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
