import '@testing-library/jest-dom';
import { expect, afterEach, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;

// Reset all mocks and clear indexedDB after each test
afterEach(async () => {
  vi.clearAllMocks();

  // Clear indexedDB database
  if (typeof indexedDB !== 'undefined') {
    return new Promise<void>((resolve) => {
      const deleteRequest = indexedDB.deleteDatabase('novossh-offline');
      deleteRequest.onsuccess = () => {
        setTimeout(() => resolve(), 100);
      };
      deleteRequest.onerror = () => {
        setTimeout(() => resolve(), 100);
      };
    });
  }
});

// Suppress console errors in tests (optional)
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalError;
});
