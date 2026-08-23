import { useEffect, useState } from 'react';
import { AlertCircle, Loader, Trash2, Check, Plus, CreditCard } from '@/lib/icons';
import { useStore } from '../lib/store';
import {
  fetchPaymentMethods,
  addPaymentMethod,
  setDefaultPaymentMethod,
  deletePaymentMethod,
} from '../lib/billingApi';
import { PaymentMethodForm } from '../components/Portal/PaymentMethodForm';
import type { PaymentMethod } from '../lib/types';

export function PaymentMethodsPage() {
  const { auth } = useStore();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.accessToken) {
      window.location.href = '/';
      return;
    }

    loadPaymentMethods();
  }, [auth.isAuthenticated, auth.accessToken]);

  const loadPaymentMethods = async () => {
    if (!auth.accessToken) return;

    try {
      setLoading(true);
      setError(null);
      const data = await fetchPaymentMethods(auth.accessToken);
      setPaymentMethods(data.paymentMethods);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payment methods');
      console.error('Failed to load payment methods:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPaymentMethod = async (paymentMethodId: string, cardName: string) => {
    if (!auth.accessToken) return;

    try {
      setSubmitting(true);
      const newMethod = await addPaymentMethod(auth.accessToken, paymentMethodId, cardName);
      setPaymentMethods([...paymentMethods, newMethod]);
      setShowForm(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add payment method');
      console.error('Failed to add payment method:', err);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    if (!auth.accessToken) return;

    try {
      await setDefaultPaymentMethod(auth.accessToken, paymentMethodId);
      setPaymentMethods(
        paymentMethods.map((pm) => ({
          ...pm,
          isDefault: pm.id === paymentMethodId,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default payment method');
      console.error('Failed to set default payment method:', err);
    }
  };

  const handleDelete = async (paymentMethodId: string) => {
    if (!auth.accessToken) return;

    try {
      setDeletingId(paymentMethodId);
      await deletePaymentMethod(auth.accessToken, paymentMethodId);
      setPaymentMethods(paymentMethods.filter((pm) => pm.id !== paymentMethodId));
      setDeleteConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete payment method');
      console.error('Failed to delete payment method:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const formatExpiry = (month: number, year: number) => {
    return `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;
  };

  const getBrandColor = (brand: string) => {
    const brands: Record<string, string> = {
      visa: 'text-blue-400',
      mastercard: 'text-orange-400',
      amex: 'text-green-400',
      discover: 'text-yellow-400',
    };
    return brands[brand.toLowerCase()] || 'text-slate-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Payment Methods</h2>
          <p className="mt-1 text-sm text-slate-400">
            Manage your saved payment methods and payment preferences
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Payment Method
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
            <div>
              <p className="font-medium text-red-200">Error</p>
              <p className="mt-1 text-sm text-red-300/80">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Method Form */}
      {showForm && (
        <div className="rounded-lg border border-white/10 bg-ink-800 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Add New Payment Method</h3>
          <PaymentMethodForm
            onSubmit={handleAddPaymentMethod}
            onCancel={() => setShowForm(false)}
            isLoading={submitting}
          />
        </div>
      )}

      {/* Payment Methods List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        ) : paymentMethods.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/10 bg-ink-800/50 p-12 text-center">
            <CreditCard className="mx-auto h-12 w-12 text-slate-500" />
            <p className="mt-4 text-slate-400">No payment methods saved yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Your First Card
            </button>
          </div>
        ) : (
          paymentMethods.map((method) => (
            <div
              key={method.id}
              className={`rounded-lg border p-6 transition-colors ${
                method.isDefault
                  ? 'border-blue-500/30 bg-blue-500/5'
                  : 'border-white/10 bg-ink-800 hover:border-white/20'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`rounded-lg bg-ink-900 p-3 ${getBrandColor(method.brand)}`}>
                    <CreditCard className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white">
                        {method.brand.charAt(0).toUpperCase() + method.brand.slice(1)} ending in {method.last4}
                      </h3>
                      {method.isDefault && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-300 border border-green-500/20">
                          <Check className="h-3 w-3" />
                          Default
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      Expires {formatExpiry(method.expiryMonth, method.expiryYear)}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      Added {new Date(method.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!method.isDefault && (
                    <button
                      onClick={() => handleSetDefault(method.id)}
                      className="rounded-lg bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
                    >
                      Set as Default
                    </button>
                  )}

                  <div className="relative">
                    <button
                      onClick={() =>
                        setDeleteConfirm(deleteConfirm === method.id ? null : method.id)
                      }
                      className="rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    {deleteConfirm === method.id && (
                      <div className="absolute right-0 mt-2 w-48 rounded-lg border border-white/10 bg-ink-900 p-4 shadow-lg z-10">
                        <p className="text-sm text-slate-300">
                          Are you sure you want to delete this payment method?
                        </p>
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="flex-1 rounded bg-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-600 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDelete(method.id)}
                            disabled={deletingId === method.id}
                            className="flex-1 rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                          >
                            {deletingId === method.id ? (
                              <Loader className="h-3 w-3 animate-spin" />
                            ) : (
                              'Delete'
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
