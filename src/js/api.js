/**
 * API Client for ADHD Kanban
 * Handles all communication with the Django REST API
 * 
 * Works as both ES module (for tests) and browser global
 */

const CONFIG = {
    // Switch to localhost for local development
    // API_BASE: 'http://localhost:8000/api/v1',
    API_BASE: 'https://adhdkanban-production.up.railway.app/api/v1',
};

// Token management
function getToken() {
    return localStorage.getItem('auth_token');
}

function setToken(token) {
    localStorage.setItem('auth_token', token);
}

function clearToken() {
    localStorage.removeItem('auth_token');
}

function isAuthenticated() {
    return !!getToken();
}

// API request helper
async function apiRequest(endpoint, options = {}) {
    const url = `${CONFIG.API_BASE}${endpoint}`;
    const token = getToken();
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    
    if (token) {
        headers['Authorization'] = `Token ${token}`;
    }
    
    let response;
    try {
        response = await fetch(url, {
            ...options,
            headers,
        });
    } catch (error) {
        // Handle network errors
        throw new Error('Network error: Unable to connect to server');
    }
    
    // Handle 401 - redirect to login
    if (response.status === 401) {
        clearToken();
        if (typeof window !== 'undefined' && window.location) {
            window.location.href = 'index.html';
        }
        throw new Error('Session expired');
    }
    
    // Handle 204 No Content
    if (response.status === 204) {
        return null;
    }
    
    // Parse JSON response, handling potential parsing errors
    let data;
    try {
        // Check content-type if headers are available
        const contentType = response.headers?.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else if (contentType) {
            // Response is not JSON, try to get text for error message
            const text = await response.text();
            throw new Error(text || `Server returned ${response.status} ${response.statusText}`);
        } else {
            // No content-type header, try to parse as JSON (for test mocks)
            data = await response.json();
        }
    } catch (error) {
        // If JSON parsing fails or response is not JSON
        if (error instanceof SyntaxError) {
            throw new Error(`Invalid response from server: ${response.status} ${response.statusText}`);
        }
        // Re-throw if it's already an Error we created
        throw error;
    }
    
    if (!response.ok) {
        // Extract error message from response
        let message = 'Request failed';
        if (data && typeof data === 'object') {
            if (data.error) {
                message = data.error;
            } else if (data.detail) {
                message = data.detail;
            } else if (data.username) {
                message = Array.isArray(data.username) ? data.username[0] : data.username;
            } else if (data.password) {
                message = Array.isArray(data.password) ? data.password[0] : data.password;
            } else if (data.non_field_errors) {
                message = Array.isArray(data.non_field_errors) ? data.non_field_errors[0] : data.non_field_errors;
            }
        }
        throw new Error(message);
    }
    
    return data;
}

// API methods
const api = {
    // Auth
    async login(username, password) {
        const data = await apiRequest('/auth/login/', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
        setToken(data.token);
        return data;
    },
    
    async register(username, password, email = null) {
        const body = {
            username,
            password,
            password_confirm: password,
        };
        if (email) {
            body.email = email;
        }
        const data = await apiRequest('/auth/register/', {
            method: 'POST',
            body: JSON.stringify(body),
        });
        setToken(data.token);
        return data;
    },
    
    async logout() {
        try {
            await apiRequest('/auth/logout/', { method: 'POST' });
        } catch (e) {
            // Ignore errors - we're logging out anyway
        } finally {
            clearToken();
        }
    },
    
    async getCurrentUser() {
        return await apiRequest('/auth/me/');
    },
    
    // Board
    async getBoard() {
        return await apiRequest('/board/');
    },
    
    // Columns
    async createColumn(name) {
        return await apiRequest('/columns/', {
            method: 'POST',
            body: JSON.stringify({ name }),
        });
    },
    
    async updateColumn(id, name) {
        return await apiRequest(`/columns/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ name }),
        });
    },
    
    async deleteColumn(id) {
        return await apiRequest(`/columns/${id}/`, {
            method: 'DELETE',
        });
    },
    
    async reorderColumns(columnOrders) {
        return await apiRequest('/reorder-columns/', {
            method: 'POST',
            body: JSON.stringify({ column_orders: columnOrders }),
        });
    },
    
    // Tasks
    async createTask(title, columnId, description = '') {
        const body = { title, column_id: columnId };
        if (description) {
            body.description = description;
        }
        return await apiRequest('/tasks/', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    },
    
    async updateTask(id, title, description) {
        return await apiRequest(`/tasks/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ title, description }),
        });
    },
    
    async deleteTask(id) {
        return await apiRequest(`/tasks/${id}/`, {
            method: 'DELETE',
        });
    },
    
    async moveTask(taskId, columnId) {
        return await apiRequest(`/tasks/${taskId}/move/`, {
            method: 'POST',
            body: JSON.stringify({ column_id: columnId }),
        });
    },
    
    async reorderTasks(taskOrders) {
        return await apiRequest('/reorder-tasks/', {
            method: 'POST',
            body: JSON.stringify({ task_orders: taskOrders }),
        });
    },
};

// Export for testing - these exports work when imported as ES module
// In browser, these are ignored and globals are used instead
export { CONFIG, getToken, setToken, clearToken, isAuthenticated, apiRequest, api };
export default api;
