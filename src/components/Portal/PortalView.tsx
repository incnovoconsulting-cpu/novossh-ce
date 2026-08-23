import { useState, useEffect } from 'react';
import { FileText, CreditCard, Settings, ArrowLeft, ExternalLink, Check, Trash2 } from '@/lib/icons';
import clsx from 'clsx';

type PortalTab = 'invoices' | 'payment-methods';

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: string;
  amount: number;
  currency: string;
  dueDate: string;
  paidDate?: string;
  invoiceUrl?: string;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

const brandEmoji: Record<string, string> = {
  visa: '💳', mastercard: '💳', amex: '💳', discover: '💳',
};

export function PortalView({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<PortalTab>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadData();
    return () => { cancelled = true; };
  }, [tab]);

  async function loadData() {
    setLoading(true);
    try {
      const token = localStorage.getItem('novossh-auth');
      if (tab === 'invoices') {
        const res = await fetch(`${API_BASE}/api/portal/invoices`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setInvoices(data.invoices || []);
        }
      } else {
        const res = await fetch(`${API_BASE}/api/portal/payment-methods`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPaymentMethods(data.paymentMethods || []);
        }
      }
    } catch (e) {
      console.error('Portal load error:', e);
    }
    setLoading(false);
  }

  async function setDefaultPayment(id: string) {
    const token = localStorage.getItem('novossh-auth');
    await fetch(`${API_BASE}/api/portal/payment-methods/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isDefault: true }),
    });
    loadData();
  }

  async function deletePayment(id: string) {
    const token = localStorage.getItem('novossh-auth');
    await fetch(`${API_BASE}/api/portal/payment-methods/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    loadData();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="btn-ghost p-2">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Billing Portal</h1>
          <p className="text-sm text-slate-400">Manage invoices and payment methods</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-white/[0.04]">
        {([
          { key: 'invoices' as const, label: 'Invoices', icon: FileText },
          { key: 'payment-methods' as const, label: 'Payment Methods', icon: CreditCard },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === t.key
                ? 'border-neon text-neon'
                : 'border-transparent text-slate-400 hover:text-slate-200',
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 border-2 border-neon border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === 'invoices' ? (
        <InvoiceList invoices={invoices} />
      ) : (
        <PaymentMethodList
          methods={paymentMethods}
          onSetDefault={setDefaultPayment}
          onDelete={deletePayment}
        />
      )}
    </div>
  );
}

function InvoiceList({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText className="h-12 w-12 text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-400">No invoices yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {invoices.map((inv) => (
        <div
          key={inv.id}
          className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-ink-800 p-4"
        >
          <div>
            <div className="text-sm font-medium text-slate-100">
              {inv.invoiceNumber || inv.id.slice(0, 8)}
            </div>
            <div className="text-xs text-slate-500">
              {new Date(inv.dueDate).toLocaleDateString()} · ${(inv.amount / 100).toFixed(2)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={clsx(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              inv.status === 'paid' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400',
            )}>
              {inv.status}
            </span>
            {inv.invoiceUrl && (
              <a
                href={inv.invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded p-1 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PaymentMethodList({
  methods,
  onSetDefault,
  onDelete,
}: {
  methods: PaymentMethod[];
  onSetDefault: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (methods.length === 0) {
    return (
      <div className="text-center py-16">
        <CreditCard className="h-12 w-12 text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-400">No payment methods on file</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {methods.map((pm) => (
        <div
          key={pm.id}
          className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-ink-800 p-4"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{brandEmoji[pm.brand] || '💳'}</span>
            <div>
              <div className="text-sm font-medium text-slate-100">
                {pm.brand.toUpperCase()} •••• {pm.last4}
              </div>
              <div className="text-xs text-slate-500">
                Expires {pm.expMonth}/{pm.expYear}
                {pm.isDefault && <span className="ml-2 text-neon">Default</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!pm.isDefault && (
              <button
                onClick={() => onSetDefault(pm.id)}
                className="rounded p-1 text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
                title="Set as default"
              >
                <Check className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => onDelete(pm.id)}
              className="rounded p-1 text-slate-400 hover:bg-red-500/10 hover:text-red-400"
              title="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
