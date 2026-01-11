/**
 * Mock helpers for unit tests
 * Provides reusable mock data and utilities
 */

import { vi } from 'vitest';

// Mock board data
export const mockBoardData = {
  columns: [
    {
      id: 1,
      name: 'Backlog',
      order: 1,
      tasks: [
        { id: 101, title: 'Task 1', description: 'Description 1', order: 1, column: 1 },
        { id: 102, title: 'Task 2', description: '', order: 2, column: 1 },
      ],
    },
    {
      id: 2,
      name: 'In Progress',
      order: 2,
      tasks: [
        { id: 201, title: 'Active Task', description: 'Working on it', order: 1, column: 2 },
      ],
    },
    {
      id: 3,
      name: 'Done',
      order: 3,
      tasks: [],
    },
  ],
};

// Mock user data
export const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
};

// Mock auth response
export const mockAuthResponse = {
  token: 'mock-auth-token-12345',
  user: mockUser,
};

/**
 * Creates a mock fetch response
 */
export function createMockResponse(data, options = {}) {
  const { status = 200, ok = true, headers = {} } = options;
  
  return Promise.resolve({
    ok,
    status,
    headers: new Headers(headers),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

/**
 * Creates a mock fetch that returns different responses based on URL
 */
export function createMockFetch(responseMap) {
  return vi.fn((url, options) => {
    for (const [pattern, response] of Object.entries(responseMap)) {
      if (url.includes(pattern)) {
        if (typeof response === 'function') {
          return response(url, options);
        }
        return createMockResponse(response);
      }
    }
    return createMockResponse({ error: 'Not found' }, { status: 404, ok: false });
  });
}

/**
 * Sets up a complete mock API for board operations
 */
export function setupMockApi() {
  const state = {
    board: JSON.parse(JSON.stringify(mockBoardData)),
    user: mockUser,
    token: null,
  };

  return createMockFetch({
    '/auth/login/': (url, options) => {
      state.token = mockAuthResponse.token;
      return createMockResponse(mockAuthResponse);
    },
    '/auth/register/': (url, options) => {
      state.token = mockAuthResponse.token;
      return createMockResponse(mockAuthResponse);
    },
    '/auth/logout/': () => {
      state.token = null;
      return createMockResponse(null, { status: 204 });
    },
    '/auth/me/': () => createMockResponse(state.user),
    '/board/': () => createMockResponse(state.board),
    '/tasks/': (url, options) => {
      if (options?.method === 'POST') {
        const body = JSON.parse(options.body);
        const newTask = {
          id: Date.now(),
          title: body.title,
          description: body.description || '',
          column: body.column_id,
          order: 999,
        };
        return createMockResponse(newTask);
      }
      return createMockResponse({ error: 'Method not allowed' }, { status: 405, ok: false });
    },
    '/columns/': (url, options) => {
      if (options?.method === 'POST') {
        const body = JSON.parse(options.body);
        const newColumn = {
          id: Date.now(),
          name: body.name,
          order: state.board.columns.length + 1,
          tasks: [],
        };
        return createMockResponse(newColumn);
      }
      return createMockResponse({ error: 'Method not allowed' }, { status: 405, ok: false });
    },
  });
}

/**
 * Creates a mock localStorage implementation
 */
export function createMockLocalStorage() {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index) => Object.keys(store)[index] || null),
  };
}
