import { useEffect, useState } from 'react';
import { AlertCircle, Download, Loader, Calendar } from '@/lib/icons';
import { useStore } from '../lib/store';
import { fetchInvoices, downloadInvoice } from '../lib/billingApi';
import type { Invoice } from '../lib/types';

export function InvoicesPage() {
  const { auth } = useStore();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});
  const [currentPage, setCurrentPage] = useState(0);
  const [total, setTotal] = useState(0);

  const itemsPerPage = 10;

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.accessToken) {
      window.location.href = '/';
      return;
    }

    loadInvoices();
  }, [auth.isAuthenticated, auth.accessToken, currentPage]);

  const loadInvoices = async () => {
    if (!auth.accessToken) return;

    try {
      setLoading(true);
      setError(null);
      const data = await fetchInvoices(auth.accessToken, itemsPerPage, currentPage * itemsPerPage);
      setInvoices(data.invoices);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (invoice: Invoice) => {
    if (!auth.accessToken || !invoice.downloadUrl) return;

    try {
      setDownloading(invoice.id);
      const blob = await downloadInvoice(auth.accessToken, invoice.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download invoice:', err);
      setError('Failed to download invoice');
    } finally {
      setDownloading(null);
    }
  };

  const getStatusBadge = (status: Invoice['status']) => {
    const statusClasses = {
      paid: 'bg-green-500/10 text-green-300 border-green-500/20',
      pending: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
      failed: 'bg-red-500/10 text-red-300 border-red-500/20',
      voided: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
    };

    const statusLabels = {
      paid: 'Paid',
      pending: 'Pending',
      failed: 'Failed',
      voided: 'Voided',
    };

    return (
      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusClasses[status]}`}>
        {statusLabels[status]}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const totalPages = Math.ceil(total / itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Invoices</h2>
        <p className="mt-1 text-sm text-slate-400">
          View and download your billing invoices
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
            <div>
              <p className="font-medium text-red-200">Error loading invoices</p>
              <p className="mt-1 text-sm text-red-300/80">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          <input
            type="date"
            value={dateRange.start || ''}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="rounded border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white placeholder-slate-500 hover:border-white/20"
            placeholder="From"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={dateRange.end || ''}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="rounded border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white placeholder-slate-500 hover:border-white/20"
            placeholder="To"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-white/10 bg-ink-800">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-slate-400">No invoices found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 bg-ink-900">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-300">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-300">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-ink-900/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-white">
                      {invoice.invoiceNumber}
                    </div>
                    <div className="text-xs text-slate-400">
                      {invoice.description}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300">
                    {formatDate(invoice.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-white">
                    {formatCurrency(invoice.amount, invoice.currency)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {getStatusBadge(invoice.status)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDownload(invoice)}
                      disabled={downloading === invoice.id || !invoice.downloadUrl}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {downloading === invoice.id ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-400">
            Showing {currentPage * itemsPerPage + 1} to{' '}
            {Math.min((currentPage + 1) * itemsPerPage, total)} of {total} invoices
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="rounded border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageNum = Math.max(0, currentPage - 2) + i;
              if (pageNum >= totalPages) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`rounded px-3 py-2 text-sm transition-colors ${
                    currentPage === pageNum
                      ? 'bg-blue-500 text-white'
                      : 'border border-white/10 text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage === totalPages - 1}
              className="rounded border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
