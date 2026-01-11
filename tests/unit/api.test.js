/**
 * Unit tests for api.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  CONFIG, 
  getToken, 
  setToken, 
  clearToken, 
  isAuthenticated, 
  apiRequest, 
  api 
} from '../../src/js/api.js';

// Helper to create mock fetch responses
function mockFetchResponse(data, status = 200, ok = true) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
  });
}

describe('Token Management', () => {
  it('getToken returns null when no token stored', () => {
    expect(getToken()).toBeNull();
  });

  it('setToken stores token in localStorage', () => {
    setToken('test-token-123');
    expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'test-token-123');
  });

  it('getToken retrieves stored token', () => {
    localStorage.getItem.mockReturnValueOnce('my-token');
    expect(getToken()).toBe('my-token');
  });

  it('clearToken removes token from localStorage', () => {
    clearToken();
    expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
  });

  it('isAuthenticated returns false when no token', () => {
    localStorage.getItem.mockReturnValueOnce(null);
    expect(isAuthenticated()).toBe(false);
  });

  it('isAuthenticated returns true when token exists', () => {
    localStorage.getItem.mockReturnValueOnce('some-token');
    expect(isAuthenticated()).toBe(true);
  });
});

describe('apiRequest', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it('makes GET request to correct URL', async () => {
    fetch.mockResolvedValueOnce(mockFetchResponse({ data: 'test' }));

    await apiRequest('/test/');

    expect(fetch).toHaveBeenCalledWith(
      `${CONFIG.API_BASE}/test/`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('includes auth token in header when present', async () => {
    localStorage.getItem.mockReturnValueOnce('my-auth-token');
    fetch.mockResolvedValueOnce(mockFetchResponse({ data: 'test' }));

    await apiRequest('/test/');

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Token my-auth-token',
        }),
      })
    );
  });

  it('handles 204 No Content response', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: () => Promise.reject('Should not be called'),
    });

    const result = await apiRequest('/delete/');

    expect(result).toBeNull();
  });

  it('throws error on 401 and clears token', async () => {
    localStorage.getItem.mockReturnValueOnce('expired-token');
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ detail: 'Invalid token' }),
    });

    await expect(apiRequest('/protected/')).rejects.toThrow('Session expired');
    expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
  });

  it('throws error with message from response.error', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Custom error message' }),
    });

    await expect(apiRequest('/bad/')).rejects.toThrow('Custom error message');
  });

  it('throws error with message from response.detail', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ detail: 'Not found' }),
    });

    await expect(apiRequest('/missing/')).rejects.toThrow('Not found');
  });
});

describe('api.login', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it('sends correct login request', async () => {
    fetch.mockResolvedValueOnce(mockFetchResponse({ token: 'new-token', user: { id: 1 } }));

    await api.login('testuser', 'testpass');

    expect(fetch).toHaveBeenCalledWith(
      `${CONFIG.API_BASE}/auth/login/`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'testuser', password: 'testpass' }),
      })
    );
  });

  it('stores token on successful login', async () => {
    fetch.mockResolvedValueOnce(mockFetchResponse({ token: 'login-token-xyz' }));

    await api.login('user', 'pass');

    expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'login-token-xyz');
  });

  it('returns login response data', async () => {
    const responseData = { token: 'abc', user: { id: 1, username: 'testuser' } };
    fetch.mockResolvedValueOnce(mockFetchResponse(responseData));

    const result = await api.login('user', 'pass');

    expect(result).toEqual(responseData);
  });
});

describe('api.register', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it('sends correct register request without email', async () => {
    fetch.mockResolvedValueOnce(mockFetchResponse({ token: 'new-token' }));

    await api.register('newuser', 'password123');

    expect(fetch).toHaveBeenCalledWith(
      `${CONFIG.API_BASE}/auth/register/`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          username: 'newuser',
          password: 'password123',
          password_confirm: 'password123',
        }),
      })
    );
  });

  it('includes email when provided', async () => {
    fetch.mockResolvedValueOnce(mockFetchResponse({ token: 'new-token' }));

    await api.register('newuser', 'password123', 'test@example.com');

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          username: 'newuser',
          password: 'password123',
          password_confirm: 'password123',
          email: 'test@example.com',
        }),
      })
    );
  });

  it('stores token on successful registration', async () => {
    fetch.mockResolvedValueOnce(mockFetchResponse({ token: 'register-token' }));

    await api.register('newuser', 'pass');

    expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', 'register-token');
  });
});

describe('api.logout', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it('calls logout endpoint', async () => {
    fetch.mockResolvedValueOnce(mockFetchResponse(null, 204));

    await api.logout();

    expect(fetch).toHaveBeenCalledWith(
      `${CONFIG.API_BASE}/auth/logout/`,
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('clears token even if logout fails', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    await api.logout();

    expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
  });
});

describe('api.getBoard', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it('fetches board data', async () => {
    const boardData = {
      columns: [
        { id: 1, name: 'Backlog', tasks: [] },
        { id: 2, name: 'In Progress', tasks: [] },
      ],
    };
    fetch.mockResolvedValueOnce(mockFetchResponse(boardData));

    const result = await api.getBoard();

    expect(fetch).toHaveBeenCalledWith(
      `${CONFIG.API_BASE}/board/`,
      expect.any(Object)
    );
    expect(result).toEqual(boardData);
  });
});

describe('api.createTask', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it('creates task with title and column', async () => {
    const newTask = { id: 1, title: 'New Task', column: 2 };
    fetch.mockResolvedValueOnce(mockFetchResponse(newTask));

    await api.createTask('New Task', 2);

    expect(fetch).toHaveBeenCalledWith(
      `${CONFIG.API_BASE}/tasks/`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'New Task', column_id: 2 }),
      })
    );
  });

  it('includes description when provided', async () => {
    fetch.mockResolvedValueOnce(mockFetchResponse({ id: 1 }));

    await api.createTask('Task', 1, 'Task description');

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          title: 'Task',
          column_id: 1,
          description: 'Task description',
        }),
      })
    );
  });
});

describe('api.moveTask', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it('moves task to new column', async () => {
    fetch.mockResolvedValueOnce(mockFetchResponse({ id: 5, column: 3 }));

    await api.moveTask(5, 3);

    expect(fetch).toHaveBeenCalledWith(
      `${CONFIG.API_BASE}/tasks/5/move/`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ column_id: 3 }),
      })
    );
  });
});

describe('api.reorderTasks', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it('sends task order updates', async () => {
    const taskOrders = [
      { id: 1, order: 1 },
      { id: 2, order: 2 },
      { id: 3, order: 3 },
    ];
    fetch.mockResolvedValueOnce(mockFetchResponse({ success: true }));

    await api.reorderTasks(taskOrders);

    expect(fetch).toHaveBeenCalledWith(
      `${CONFIG.API_BASE}/reorder-tasks/`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ task_orders: taskOrders }),
      })
    );
  });
});

describe('api.reorderColumns', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it('sends column order updates', async () => {
    const columnOrders = [
      { id: 1, order: 1 },
      { id: 2, order: 2 },
    ];
    fetch.mockResolvedValueOnce(mockFetchResponse({ success: true }));

    await api.reorderColumns(columnOrders);

    expect(fetch).toHaveBeenCalledWith(
      `${CONFIG.API_BASE}/reorder-columns/`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ column_orders: columnOrders }),
      })
    );
  });
});

describe('api.deleteTask', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it('deletes task by id', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: () => Promise.reject('Should not be called'),
    });

    const result = await api.deleteTask(42);

    expect(fetch).toHaveBeenCalledWith(
      `${CONFIG.API_BASE}/tasks/42/`,
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(result).toBeNull();
  });
});

describe('api.deleteColumn', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it('deletes column by id', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: () => Promise.reject('Should not be called'),
    });

    await api.deleteColumn(7);

    expect(fetch).toHaveBeenCalledWith(
      `${CONFIG.API_BASE}/columns/7/`,
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});
