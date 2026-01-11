/**
 * Vitest setup - runs before each test file
 * Sets up browser environment mocks
 */

import { vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock window.location
const locationMock = {
  href: 'http://localhost:1420/',
  origin: 'http://localhost:1420',
  pathname: '/',
  search: '',
  hash: '',
  assign: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn(),
};

Object.defineProperty(globalThis, 'location', {
  value: locationMock,
  writable: true,
});

// Global fetch mock - can be overridden in individual tests
globalThis.fetch = vi.fn();

// Reset mocks between tests
beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
  locationMock.href = 'http://localhost:1420/';
});

afterEach(() => {
  vi.restoreAllMocks();
});
