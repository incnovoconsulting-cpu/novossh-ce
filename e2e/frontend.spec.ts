import { test, expect } from '@playwright/test';

test.describe('NovoSSH Frontend', () => {
  test('loads homepage', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/NovoSSH/);
  });

  test('has no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForTimeout(3000);
    // Filter out expected network errors (CORS on WebSocket, etc)
    const criticalErrors = errors.filter(e => !e.includes('WebSocket') && !e.includes('net::'));
    expect(criticalErrors).toEqual([]);
  });

  test('loads CSS and JS assets', async ({ page }) => {
    await page.goto('/');
    const cssLink = page.locator('link[rel="stylesheet"][crossorigin]');
    await expect(cssLink).toHaveCount(1);
    const scriptTag = page.locator('script[type="module"][crossorigin]');
    await expect(scriptTag).toHaveCount(1);
  });

  test('renders React root', async ({ page }) => {
    await page.goto('/');
    const root = page.locator('#root');
    await expect(root).toBeAttached();
    // Wait for React to mount
    await page.waitForTimeout(2000);
    const innerHtml = await root.innerHTML();
    expect(innerHtml.length).toBeGreaterThan(0);
  });

  const apiUrl = process.env.NOVOSSH_API_URL || 'http://localhost:8787';

  test('backend health endpoint accessible', async ({ page }) => {
    const response = await page.request.get(`${apiUrl}/api/health`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe('novossh');
  });

  test('backend CORS headers present', async ({ page }) => {
    const origin = process.env.NOVOSSH_WEB_ORIGIN || 'http://localhost:5173';
    const response = await page.request.get(`${apiUrl}/api/health`, {
      headers: { 'Origin': origin }
    });
    const corsHeader = response.headers()['access-control-allow-origin'];
    expect(corsHeader).toBe(origin);
  });

  test('takes screenshot of homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'e2e/screenshots/homepage.png', fullPage: true });
  });
});
