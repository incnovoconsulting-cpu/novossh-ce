import { useState, FC } from 'react';
import styles from './Auth.module.css';

interface MFASetupProps {
  onComplete: (credentials: any[]) => void;
  onCancel: () => void;
}

export const MFASetup: FC<MFASetupProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState<'selection' | 'registration' | 'backup'>('selection');
  const [registering, setRegistering] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const handleWebAuthnSetup = async () => {
    setRegistering(true);
    try {
      // Request registration options
      const optionsRes = await fetch('/api/webauthn/register-options', {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      });

      if (!optionsRes.ok) throw new Error('Failed to get registration options');

      const { options: _options } = await optionsRes.json();

      // In production, use actual WebAuthn API
      // For now, mock the credential creation
      const credential = {
        id: Math.random().toString(36).substring(7),
        publicKey: 'mock-public-key',
        attestationType: 'direct',
        transports: ['usb'],
        name: 'Security Key',
      };

      // Verify credential with server
      const verifyRes = await fetch('/api/webauthn/register-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify(credential),
      });

      if (!verifyRes.ok) throw new Error('Failed to verify credential');

      // Generate backup codes
      const codesRes = await fetch('/api/webauthn/backup-codes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      });

      if (!codesRes.ok) throw new Error('Failed to generate backup codes');

      const { backupCodes: codes } = await codesRes.json();
      setBackupCodes(codes);
      setStep('backup');
      onComplete([credential]);
    } catch (error) {
      console.error('WebAuthn setup failed:', error);
      alert('Failed to set up security key. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.mfaSetup}>
      {step === 'selection' && (
        <div>
          <h2>Set Up Multi-Factor Authentication</h2>
          <p>Protect your account with MFA using WebAuthn (FIDO2)</p>

          <div className={styles.mfaOptions}>
            <button onClick={handleWebAuthnSetup} disabled={registering} className={styles.primaryBtn}>
              {registering ? 'Setting up...' : 'Set Up Security Key'}
            </button>
          </div>

          <button onClick={onCancel} className={styles.secondaryBtn}>
            Skip for now
          </button>
        </div>
      )}

      {step === 'backup' && (
        <div>
          <h2>Save Backup Codes</h2>
          <p>
            Save these codes in a safe place. You can use them to access your account if you lose your security
            key.
          </p>

          <div className={styles.backupCodes}>
            {backupCodes.map((code) => (
              <code key={code}>{code}</code>
            ))}
          </div>

          <button onClick={copyToClipboard} className={styles.primaryBtn}>
            {copied ? 'Copied!' : 'Copy Codes'}
          </button>

          <button onClick={onCancel} className={styles.secondaryBtn}>
            Done
          </button>
        </div>
      )}
    </div>
  );
};
