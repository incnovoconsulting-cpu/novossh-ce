import { useState, FormEvent } from 'react';

interface PaymentMethodFormProps {
  onSubmit: (paymentMethodId: string, cardName: string) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function PaymentMethodForm({ onSubmit, onCancel, isLoading }: PaymentMethodFormProps) {
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [cardName, setCardName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!paymentMethodId || !cardName) {
      setError('Please fill in all fields');
      return;
    }

    try {
      await onSubmit(paymentMethodId, cardName);
      setPaymentMethodId('');
      setCardName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add payment method');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-500/10 text-red-400 px-4 py-2 rounded border border-red-500/30">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Payment Method ID
        </label>
        <input
          type="text"
          value={paymentMethodId}
          onChange={(e) => setPaymentMethodId(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500"
          placeholder="pm_1234567890"
          disabled={isLoading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Card Name
        </label>
        <input
          type="text"
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500"
          placeholder="My Visa Card"
          disabled={isLoading}
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 px-4 py-2 bg-neon-600 hover:bg-neon-700 disabled:bg-gray-600 text-white rounded font-medium transition-colors"
        >
          {isLoading ? 'Adding...' : 'Add Payment Method'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 text-white rounded font-medium transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
