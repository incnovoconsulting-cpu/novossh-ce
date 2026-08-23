import { useState, FC, FormEvent } from 'react';
import styles from './CreateEntryDialog.module.css';

interface CreateEntryDialogProps {
  onCreate: (type: string, name: string, plaintextData: string) => Promise<void>;
  onClose: () => void;
}

interface SshFields {
  host: string;
  port: string;
  username: string;
  authMethod: 'password' | 'key';
  password: string;
  privateKey: string;
  passphrase: string;
}

export const CreateEntryDialog: FC<CreateEntryDialogProps> = ({ onCreate, onClose }) => {
  const [type, setType] = useState<string>('password');
  const [name, setName] = useState('');
  const [data, setData] = useState('');
  const [ssh, setSsh] = useState<SshFields>({
    host: '', port: '22', username: '', authMethod: 'password',
    password: '', privateKey: '', passphrase: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const types = [
    { value: 'ssh', label: '🖥️ SSH Host' },
    { value: 'password', label: '🔑 Password' },
    { value: 'key', label: '🗝️ SSH Key' },
    { value: 'token', label: '🎟️ Token' },
    { value: 'config', label: '⚙️ Config' },
  ];

  const setSshField = (k: keyof SshFields, v: string) => setSsh((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Name is required'); return; }

    let plaintext: string;
    if (type === 'ssh') {
      if (!ssh.host.trim() || !ssh.username.trim()) { setError('Host and username are required'); return; }
      plaintext = JSON.stringify({
        host: ssh.host.trim(),
        port: parseInt(ssh.port) || 22,
        username: ssh.username.trim(),
        ...(ssh.authMethod === 'password' ? { password: ssh.password } : { privateKey: ssh.privateKey, passphrase: ssh.passphrase }),
      });
    } else {
      if (!data.trim()) { setError('Data is required'); return; }
      plaintext = data;
    }

    setLoading(true);
    try {
      await onCreate(type, name, plaintext);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h2>Add Entry</h2>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label>Type</label>
            <div className={styles.typeGrid}>
              {types.map((t) => (
                <button key={t.value} type="button"
                  className={`${styles.typeButton} ${type === t.value ? styles.selected : ''}`}
                  onClick={() => setType(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="name">Name / Label *</label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production Web Server" required />
          </div>

          {type === 'ssh' ? (
            <>
              <div className={styles.formGroup}>
                <label>Host *</label>
                <input type="text" value={ssh.host} onChange={(e) => setSshField('host', e.target.value)}
                  placeholder="192.168.1.100 or hostname" />
              </div>
              <div className={styles.formGroup}>
                <label>Port</label>
                <input type="number" value={ssh.port} onChange={(e) => setSshField('port', e.target.value)}
                  placeholder="22" min={1} max={65535} />
              </div>
              <div className={styles.formGroup}>
                <label>Username *</label>
                <input type="text" value={ssh.username} onChange={(e) => setSshField('username', e.target.value)}
                  placeholder="ubuntu" />
              </div>
              <div className={styles.formGroup}>
                <label>Auth method</label>
                <div className={styles.typeGrid}>
                  <button type="button"
                    className={`${styles.typeButton} ${ssh.authMethod === 'password' ? styles.selected : ''}`}
                    onClick={() => setSshField('authMethod', 'password')}>Password</button>
                  <button type="button"
                    className={`${styles.typeButton} ${ssh.authMethod === 'key' ? styles.selected : ''}`}
                    onClick={() => setSshField('authMethod', 'key')}>Private Key</button>
                </div>
              </div>
              {ssh.authMethod === 'password' ? (
                <div className={styles.formGroup}>
                  <label>Password</label>
                  <input type="password" value={ssh.password} onChange={(e) => setSshField('password', e.target.value)}
                    placeholder="SSH password" />
                </div>
              ) : (
                <>
                  <div className={styles.formGroup}>
                    <label>Private Key</label>
                    <textarea value={ssh.privateKey} onChange={(e) => setSshField('privateKey', e.target.value)}
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" rows={5} />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Passphrase (if any)</label>
                    <input type="password" value={ssh.passphrase} onChange={(e) => setSshField('passphrase', e.target.value)}
                      placeholder="Key passphrase (optional)" />
                  </div>
                </>
              )}
            </>
          ) : (
            <div className={styles.formGroup}>
              <label>Data *</label>
              <textarea value={data} onChange={(e) => setData(e.target.value)}
                placeholder={type === 'key' ? 'Paste SSH key' : type === 'token' ? 'Enter API token' : 'Enter value'}
                rows={6} />
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.submit} disabled={loading}>
              {loading ? 'Creating...' : 'Create Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
