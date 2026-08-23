import { useState } from 'react';
import { Download, AlertCircle, CheckCircle } from '@/lib/icons';
import { Dialog } from '../Dialog';
import { apiFetch } from '../../lib/apiFetch';
import { useStore } from '../../lib/store';
import clsx from 'clsx';

interface SessionExportDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  sessionName?: string;
}

type ExportFormat = 'bash' | 'json';

export function SessionExportDialog({ open, onClose, sessionId, sessionName }: SessionExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('bash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const accessToken = useStore((s) => s.auth.accessToken);

  const handleExport = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await apiFetch(`/api/sessions/${sessionId}/export?format=${format}`, accessToken);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      setFileSize(blob.size);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = format === 'json'
        ? `session-${sessionName || sessionId}-export.json`
        : `session-${sessionName || sessionId}-replay.sh`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export session';
      setError(message);
      console.error('Export failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDescription = format === 'bash'
    ? 'A shell script that replays the session commands with proper timing'
    : 'Complete session data in JSON format including frames and metadata';

  const formatExtension = format === 'bash' ? '.sh' : '.json';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Export session"
      description={`Export session "${sessionName || sessionId}" in your preferred format`}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/[0.04] rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={loading || success}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-neon-600 text-white rounded-lg hover:bg-neon-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            {loading ? 'Exporting...' : success ? 'Exported!' : 'Export'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Format Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-200 mb-3">
            Export Format
          </label>
          <div className="space-y-2">
            {(['bash', 'json'] as const).map((fmt) => (
              <label
                key={fmt}
                className={clsx(
                  'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                  format === fmt
                    ? 'border-neon bg-neon/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                )}
              >
                <input
                  type="radio"
                  name="format"
                  value={fmt}
                  checked={format === fmt}
                  onChange={(e) => setFormat(e.target.value as ExportFormat)}
                  disabled={loading}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200 capitalize">{fmt} Script</div>
                  <div className="text-xs text-slate-400 mt-1">{formatDescription}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* File Size Preview */}
        {fileSize !== null && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-slate-200">
                File size: {(fileSize / 1024).toFixed(2)} KB
              </span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-slate-200">{error}</span>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="p-3 rounded-lg bg-neon/10 border border-neon/20">
          <div className="text-xs text-slate-300 space-y-1">
            <p>
              <strong>File format:</strong> {format === 'bash' ? 'Executable shell script' : 'JSON data structure'}
            </p>
            <p>
              <strong>File extension:</strong> {formatExtension}
            </p>
            {format === 'bash' && (
              <p>
                <strong>Usage:</strong> bash session-replay.sh
              </p>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
