import React, { useState, useRef, useEffect } from 'react';
import { useEmailVerification } from '../../hooks/useEmailVerification';

export function EmailVerificationBanner() {
  const { status, loading, error, cooldown, sendCode, confirmCode } = useEmailVerification();
  const [code, setCode] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInput]);

  if (status?.verified || success) return null;

  const handleSend = async () => {
    const result = await sendCode();
    if (result.success) {
      setShowInput(true);
    }
  };

  const handleConfirm = async () => {
    if (code.length !== 6) return;
    const result = await confirmCode(code);
    if (result.success) {
      setSuccess(true);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.length === 6) {
      handleConfirm();
    }
  };

  return (
    <div style={{
      background: '#fff3cd',
      borderBottom: '1px solid #ffc107',
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap',
      fontSize: '14px',
    }}>
      <span style={{ color: '#856404', fontWeight: 500 }}>
        Your email is not verified.
      </span>

      {!showInput && (
        <button
          onClick={handleSend}
          disabled={loading || cooldown > 0}
          style={{
            background: cooldown > 0 ? '#ccc' : '#0077b6',
            color: 'white',
            border: 'none',
            padding: '6px 14px',
            borderRadius: '4px',
            cursor: loading || cooldown > 0 ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          {loading ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Send Code'}
        </button>
      )}

      {showInput && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            ref={inputRef}
            type="text"
            value={code}
            onChange={handleCodeChange}
            onKeyDown={handleKeyDown}
            placeholder="6-digit code"
            maxLength={6}
            style={{
              width: '120px',
              padding: '6px 10px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
              letterSpacing: '2px',
              fontFamily: 'monospace',
            }}
          />
          <button
            onClick={handleConfirm}
            disabled={loading || code.length !== 6}
            style={{
              background: code.length === 6 ? '#28a745' : '#ccc',
              color: 'white',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '4px',
              cursor: loading || code.length !== 6 ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
          <button
            onClick={handleSend}
            disabled={loading || cooldown > 0}
            style={{
              background: 'transparent',
              color: '#0077b6',
              border: 'none',
              padding: '6px 10px',
              cursor: loading || cooldown > 0 ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              textDecoration: 'underline',
            }}
          >
            {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend'}
          </button>
        </div>
      )}

      {error && (
        <span style={{ color: '#d32f2f', fontSize: '13px' }}>{error}</span>
      )}
    </div>
  );
}
