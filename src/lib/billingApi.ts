import type { Invoice, PaymentMethod } from './types';
import { apiFetch } from './apiFetch';

export async function fetchSubscription(accessToken: string) {
  const res = await apiFetch('/api/billing/subscription', accessToken);
  if (!res.ok) throw new Error('Failed to fetch subscription');
  return res.json();
}

export async function createCheckoutSession(accessToken: string, plan: string, billing: 'monthly' | 'annual' = 'monthly') {
  const res = await apiFetch('/api/billing/create-checkout-session', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, billing }),
  });
  if (!res.ok) throw new Error('Failed to create checkout session');
  return res.json();
}

export async function createPortalSession(accessToken: string) {
  const res = await apiFetch('/api/billing/create-portal-session', accessToken, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to create portal session');
  return res.json();
}

// Portal API endpoints
export async function fetchInvoices(accessToken: string, limit = 20, offset = 0) {
  const res = await apiFetch(`/api/portal/invoices?limit=${limit}&offset=${offset}`, accessToken);
  if (!res.ok) throw new Error('Failed to fetch invoices');
  return res.json() as Promise<{ invoices: Invoice[]; total: number }>;
}

export async function downloadInvoice(accessToken: string, invoiceId: string) {
  const res = await apiFetch(`/api/portal/invoices/${invoiceId}/download`, accessToken);
  if (!res.ok) throw new Error('Failed to download invoice');
  return res.blob();
}

export async function fetchPaymentMethods(accessToken: string) {
  const res = await apiFetch('/api/portal/payment-methods', accessToken);
  if (!res.ok) throw new Error('Failed to fetch payment methods');
  return res.json() as Promise<{ paymentMethods: PaymentMethod[] }>;
}

export async function addPaymentMethod(accessToken: string, paymentMethodId: string, name: string) {
  const res = await apiFetch('/api/portal/payment-methods', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentMethodId, name }),
  });
  if (!res.ok) throw new Error('Failed to add payment method');
  return res.json() as Promise<PaymentMethod>;
}

export async function setDefaultPaymentMethod(accessToken: string, paymentMethodId: string) {
  const res = await apiFetch(`/api/portal/payment-methods/${paymentMethodId}/default`, accessToken, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to set default payment method');
  return res.json();
}

export async function deletePaymentMethod(accessToken: string, paymentMethodId: string) {
  const res = await apiFetch(`/api/portal/payment-methods/${paymentMethodId}`, accessToken, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete payment method');
  return res.json();
}

// Trial API endpoints
export async function fetchTrialStatus(accessToken: string) {
  const res = await apiFetch('/api/billing/trial/status', accessToken);
  if (!res.ok) throw new Error('Failed to fetch trial status');
  return res.json() as Promise<{
    isTrialing: boolean;
    trialEnd: string | null;
    daysRemaining: number;
    status: string;
    plan: string;
  }>;
}

export async function extendTrial(accessToken: string, days: number) {
  const res = await apiFetch('/api/billing/trial/extend', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days }),
  });
  if (!res.ok) throw new Error('Failed to extend trial');
  return res.json() as Promise<{ success: boolean; newTrialEnd: string | null }>;
}

// Downgrade API endpoints
export async function fetchDowngradePreview(accessToken: string, targetPlan: string) {
  const res = await apiFetch(`/api/billing/downgrade/preview?targetPlan=${targetPlan}`, accessToken);
  if (!res.ok) throw new Error('Failed to fetch downgrade preview');
  return res.json() as Promise<{
    currentPlan: string;
    targetPlan: string;
    preview: {
      plan: string;
      previousPlan: string;
      exceeded: { resource: string; current: number; limit: number }[];
      requiresAction: boolean;
    };
  }>;
}

export async function confirmDowngrade(accessToken: string, targetPlan: string) {
  const res = await apiFetch('/api/billing/downgrade/confirm', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetPlan }),
  });
  if (!res.ok) throw new Error('Failed to confirm downgrade');
  return res.json() as Promise<{
    success: boolean;
    previousPlan: string;
    newPlan: string;
    actions: { resourceType: string; resourceId: string; action: string; gracePeriodEndsAt: string }[];
  }>;
}
