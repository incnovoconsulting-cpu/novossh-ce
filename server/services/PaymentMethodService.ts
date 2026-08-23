import Stripe from 'stripe';
import { getDb } from '../db/connection.js';

export interface PaymentMethod {
  id: string;
  type: 'card' | 'other';
  brand?: string;
  last4?: string;
  expMonth?: number;
  expYear?: number;
  isDefault: boolean;
  createdAt: Date;
}

export class PaymentMethodService {
  private stripe: Stripe | null = null;

  constructor(stripeKey?: string) {
    const key = stripeKey || process.env.STRIPE_SECRET_KEY;
    if (!key || key === 'sk_test_placeholder') {
      console.warn('[PaymentMethodService] STRIPE_SECRET_KEY not configured - billing features disabled');
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
      console.error('[PaymentMethodService] Failed to get Stripe customer ID:', error);
      throw error;
    }
  }

  /**
   * List all payment methods for a user
   */
  async listPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    try {
      const customerId = await this.getStripeCustomerId(userId);
      if (!customerId) {
        return [];
      }

      const customer = await this.requireStripe().customers.retrieve(customerId);
      const paymentMethods = await this.requireStripe().paymentMethods.list({
        customer: customerId,
        type: 'card',
        limit: 100,
      });

      const defaultPaymentMethodId = (customer as any).invoice_settings?.default_payment_method;

      return paymentMethods.data.map((method) => ({
        id: method.id,
        type: method.type as 'card' | 'other',
        brand: (method.card?.brand as string) || undefined,
        last4: method.card?.last4 || undefined,
        expMonth: method.card?.exp_month || undefined,
        expYear: method.card?.exp_year || undefined,
        isDefault: method.id === defaultPaymentMethodId,
        createdAt: new Date(method.created * 1000),
      }));
    } catch (error) {
      console.error('[PaymentMethodService] Failed to list payment methods:', error);
      throw error;
    }
  }

  /**
   * Add a new payment method (using token from frontend)
   */
  async addPaymentMethod(userId: string, paymentMethodToken: string): Promise<PaymentMethod | null> {
    try {
      const customerId = await this.getStripeCustomerId(userId);
      if (!customerId) {
        throw new Error('User has no billing account');
      }

      // Attach payment method to customer
      const paymentMethod = await this.requireStripe().paymentMethods.attach(paymentMethodToken, {
        customer: customerId,
      });

      return {
        id: paymentMethod.id,
        type: paymentMethod.type as 'card' | 'other',
        brand: (paymentMethod.card?.brand as string) || undefined,
        last4: paymentMethod.card?.last4 || undefined,
        expMonth: paymentMethod.card?.exp_month || undefined,
        expYear: paymentMethod.card?.exp_year || undefined,
        isDefault: false,
        createdAt: new Date(paymentMethod.created * 1000),
      };
    } catch (error) {
      console.error('[PaymentMethodService] Failed to add payment method:', error);
      throw error;
    }
  }

  /**
   * Update default payment method
   */
  async updateDefaultPaymentMethod(userId: string, methodId: string): Promise<void> {
    try {
      const customerId = await this.getStripeCustomerId(userId);
      if (!customerId) {
        throw new Error('User has no billing account');
      }

      // Verify the payment method belongs to this customer
      const paymentMethod = await this.requireStripe().paymentMethods.retrieve(methodId);
      if (paymentMethod.customer !== customerId) {
        throw new Error('Payment method not found');
      }

      // Update customer's default payment method
      await this.requireStripe().customers.update(customerId, {
        invoice_settings: {
          default_payment_method: methodId,
        },
      });
    } catch (error) {
      console.error('[PaymentMethodService] Failed to update default payment method:', error);
      throw error;
    }
  }

  /**
   * Delete a payment method
   */
  async deletePaymentMethod(userId: string, methodId: string): Promise<void> {
    try {
      const customerId = await this.getStripeCustomerId(userId);
      if (!customerId) {
        throw new Error('User has no billing account');
      }

      // Verify the payment method belongs to this customer
      const paymentMethod = await this.requireStripe().paymentMethods.retrieve(methodId);
      if (paymentMethod.customer !== customerId) {
        throw new Error('Payment method not found');
      }

      // Detach the payment method from the customer
      await this.requireStripe().paymentMethods.detach(methodId);
    } catch (error) {
      console.error('[PaymentMethodService] Failed to delete payment method:', error);
      throw error;
    }
  }
}
