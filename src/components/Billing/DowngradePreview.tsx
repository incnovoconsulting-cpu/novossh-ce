import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { fetchDowngradePreview, confirmDowngrade } from '../../lib/billingApi';
import type { Plan } from '../../lib/types';

interface ExceededResource {
  resource: string;
  current: number;
  limit: number;
}

interface DowngradePreviewProps {
  targetPlan: Plan;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DowngradePreview({ targetPlan, onConfirm, onCancel }: DowngradePreviewProps) {
  const { auth } = useStore();
  const [preview, setPreview] = useState<ExceededResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.accessToken) return;

    fetchDowngradePreview(auth.accessToken, targetPlan)
      .then((data) => {
        setPreview(data.preview.exceeded);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load preview');
        setLoading(false);
      });
  }, [auth.accessToken, targetPlan]);

  const handleConfirm = async () => {
    if (!auth.accessToken) return;

    setConfirming(true);
    try {
      const result = await confirmDowngrade(auth.accessToken, targetPlan);
      if (result.success) {
        onConfirm();
      } else {
        setError('Failed to confirm downgrade');
      }
    } catch {
      setError('Failed to confirm downgrade');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-zinc-400">
        Loading downgrade preview...
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-700 p-4">
      <h3 className="text-sm font-semibold text-zinc-100 mb-3">
        Downgrade to {targetPlan.charAt(0).toUpperCase() + targetPlan.slice(1)}
      </h3>

      {preview.length === 0 ? (
        <p className="text-sm text-zinc-400 mb-4">
          No resources will be affected by this downgrade.
        </p>
      ) : (
        <div className="mb-4">
          <p className="text-sm text-zinc-400 mb-2">
            The following resources exceed the new plan limits:
          </p>
          <ul className="space-y-2">
            {preview.map((item) => (
              <li key={item.resource} className="flex items-center justify-between bg-zinc-800 rounded p-2">
                <span className="text-sm text-zinc-300 capitalize">{item.resource}</span>
                <span className="text-sm">
                  <span className="text-red-400">{item.current}</span>
                  <span className="text-zinc-500"> / </span>
                  <span className="text-zinc-400">{item.limit}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-500 mt-2">
            Excess resources will be restricted with a 30-day grace period before deletion.
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 mb-3">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={confirming}
          className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={confirming}
          className="px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors disabled:opacity-50"
        >
          {confirming ? 'Confirming...' : 'Confirm Downgrade'}
        </button>
      </div>
    </div>
  );
}
