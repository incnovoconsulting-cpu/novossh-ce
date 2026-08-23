import Stripe from 'stripe';
import { getDb } from '../db/connection.js';

export interface InvoiceLineItem {
  description: string;
  amount: number;
  currency: string;
  quantity?: number;
  period?: {
    start: Date;
    end: Date;
  };
}

export interface InvoiceDetails {
  id: string;
  amount: number;
  amountPaid: number;
  amountDue: number;
  currency: string;
  date: Date;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  pdfUrl: string | null;
  items: InvoiceLineItem[];
  description: string | null;
  dueDate: Date | null;
}

export interface InvoiceListItem {
  id: string;
  amount: number;
  currency: string;
  date: Date;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  pdfUrl: string | null;
}

export class InvoiceService {
  private stripe: Stripe | null = null;

  constructor(stripeKey?: string) {
    const key = stripeKey || process.env.STRIPE_SECRET_KEY;
    if (!key || key === 'sk_test_placeholder') {
      console.warn('[InvoiceService] STRIPE_SECRET_KEY not configured - billing features disabled');
      return;
    }
    this.stripe = new Stripe(key, { apiVersion: '2026-05-27.dahlia' });
  }

  private requireStripe(): Stripe {
    if (!this.stripe) throw new Error('Stripe not configured');
    return this.stripe;
  }

  /**
   * Get the Stripe customer ID for a user
   */
  async getStripeCustomerId(userId: string): Promise<string | null> {
    try {
      const db = getDb();
      const rows = await db`
        SELECT stripe_customer_id FROM subscriptions WHERE user_id = ${userId} LIMIT 1
      `;
      return rows[0]?.stripe_customer_id ?? null;
    } catch (error) {
      console.error('[InvoiceService] Failed to get Stripe customer ID:', error);
      throw error;
    }
  }

  /**
   * Get paginated list of invoices for a user
   */
  async fetchUserInvoices(userId: string, limit: number = 10, startingAfter?: string): Promise<InvoiceListItem[]> {
    try {
      const customerId = await this.getStripeCustomerId(userId);
      if (!customerId) {
        return [];
      }

      const invoices = await this.requireStripe().invoices.list({
        customer: customerId,
        limit: Math.min(limit, 100),
        starting_after: startingAfter,
      });

      return invoices.data.map((invoice) => ({
        id: invoice.id,
        amount: invoice.total,
        currency: invoice.currency,
        date: new Date(invoice.created * 1000),
        status: invoice.status as 'draft' | 'open' | 'paid' | 'void' | 'uncollectible',
        pdfUrl: invoice.invoice_pdf || null,
      }));
    } catch (error) {
      console.error('[InvoiceService] Failed to fetch user invoices:', error);
      throw error;
    }
  }

  /**
   * Get full details for a specific invoice
   */
  async getInvoiceDetails(userId: string, invoiceId: string): Promise<InvoiceDetails | null> {
    try {
      const customerId = await this.getStripeCustomerId(userId);
      if (!customerId) {
        return null;
      }

      // Verify the invoice belongs to this customer
      const invoice = await this.requireStripe().invoices.retrieve(invoiceId);
      if (invoice.customer !== customerId) {
        return null;
      }

      // Get line items
      const lineItems = await this.requireStripe().invoices.listLineItems(invoiceId, {
        limit: 100,
      });

      const items: InvoiceLineItem[] = lineItems.data.map((lineItem) => ({
        description: lineItem.description || 'Invoice item',
        amount: lineItem.amount,
        currency: invoice.currency,
        quantity: lineItem.quantity ?? undefined,
        period: lineItem.period ? {
          start: new Date(lineItem.period.start * 1000),
          end: new Date(lineItem.period.end * 1000),
        } : undefined,
      }));

      return {
        id: invoice.id,
        amount: invoice.total,
        amountPaid: invoice.status === 'paid' ? invoice.total : 0,
        amountDue: invoice.amount_due,
        currency: invoice.currency,
        date: new Date(invoice.created * 1000),
        status: invoice.status as 'draft' | 'open' | 'paid' | 'void' | 'uncollectible',
        pdfUrl: invoice.invoice_pdf || null,
        items,
        description: invoice.description,
        dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      };
    } catch (error) {
      console.error('[InvoiceService] Failed to get invoice details:', error);
      throw error;
    }
  }

  /**
   * Download invoice PDF URL
   * Returns the PDF URL from Stripe (the PDF is hosted by Stripe)
   */
  async downloadInvoice(userId: string, invoiceId: string): Promise<string | null> {
    try {
      const customerId = await this.getStripeCustomerId(userId);
      if (!customerId) {
        return null;
      }

      // Verify the invoice belongs to this customer
      const invoice = await this.requireStripe().invoices.retrieve(invoiceId);
      if (invoice.customer !== customerId) {
        return null;
      }

      // Return the PDF URL hosted by Stripe
      return invoice.invoice_pdf || null;
    } catch (error) {
      console.error('[InvoiceService] Failed to download invoice:', error);
      throw error;
    }
  }
}
