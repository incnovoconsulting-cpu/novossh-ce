import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { InvoiceService } from '../services/InvoiceService.js';
import { PaymentMethodService } from '../services/PaymentMethodService.js';

const router = express.Router();
const invoiceService = new InvoiceService();
const paymentMethodService = new PaymentMethodService();

/**
 * GET /api/portal/invoices
 * Get paginated list of invoices for the authenticated user
 * Query params:
 *   - limit: number (default 10, max 100)
 *   - startingAfter: string (for pagination)
 */
router.get('/invoices', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const startingAfter = req.query.startingAfter as string | undefined;

    const invoices = await invoiceService.fetchUserInvoices(userId, limit, startingAfter);

    res.json({
      data: invoices,
      count: invoices.length,
    });
  } catch (error) {
    console.error('[portal] Failed to list invoices:', error);
    res.status(500).json({ error: 'Failed to list invoices' });
  }
});

/**
 * GET /api/portal/invoices/:id
 * Get full details for a specific invoice
 */
router.get('/invoices/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const invoiceId = req.params.id;

    const invoice = await invoiceService.getInvoiceDetails(userId, invoiceId);

    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    res.json(invoice);
  } catch (error) {
    console.error('[portal] Failed to get invoice details:', error);
    res.status(500).json({ error: 'Failed to get invoice details' });
  }
});

/**
 * POST /api/portal/invoices/:id/download
 * Get download URL for invoice PDF
 */
router.post('/invoices/:id/download', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const invoiceId = req.params.id;

    const pdfUrl = await invoiceService.downloadInvoice(userId, invoiceId);

    if (!pdfUrl) {
      res.status(404).json({ error: 'Invoice not found or PDF unavailable' });
      return;
    }

    res.json({ url: pdfUrl });
  } catch (error) {
    console.error('[portal] Failed to download invoice:', error);
    res.status(500).json({ error: 'Failed to download invoice' });
  }
});

/**
 * GET /api/portal/payment-methods
 * Get list of payment methods for the authenticated user
 */
router.get('/payment-methods', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const paymentMethods = await paymentMethodService.listPaymentMethods(userId);

    res.json({
      data: paymentMethods,
      count: paymentMethods.length,
    });
  } catch (error) {
    console.error('[portal] Failed to list payment methods:', error);
    res.status(500).json({ error: 'Failed to list payment methods' });
  }
});

/**
 * POST /api/portal/payment-methods
 * Add a new payment method
 * Body:
 *   - token: string (Stripe payment method token from frontend)
 */
router.post('/payment-methods', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Payment method token is required' });
      return;
    }

    const paymentMethod = await paymentMethodService.addPaymentMethod(userId, token);

    if (!paymentMethod) {
      res.status(400).json({ error: 'Failed to add payment method' });
      return;
    }

    res.status(201).json(paymentMethod);
  } catch (error) {
    console.error('[portal] Failed to add payment method:', error);
    const message = (error as any).message || 'Failed to add payment method';
    res.status(400).json({ error: message });
  }
});

/**
 * PUT /api/portal/payment-methods/:id
 * Update default payment method
 */
router.put('/payment-methods/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const methodId = req.params.id;

    await paymentMethodService.updateDefaultPaymentMethod(userId, methodId);

    res.json({ success: true });
  } catch (error) {
    console.error('[portal] Failed to update default payment method:', error);
    const message = (error as any).message || 'Failed to update payment method';
    res.status(400).json({ error: message });
  }
});

/**
 * DELETE /api/portal/payment-methods/:id
 * Delete a payment method
 */
router.delete('/payment-methods/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const methodId = req.params.id;

    await paymentMethodService.deletePaymentMethod(userId, methodId);

    res.json({ success: true });
  } catch (error) {
    console.error('[portal] Failed to delete payment method:', error);
    const message = (error as any).message || 'Failed to delete payment method';
    res.status(400).json({ error: message });
  }
});

export { router as portalRouter };
