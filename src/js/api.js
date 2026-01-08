/**
 * API Client for ADHD Kanban
 * Handles all communication with the Django REST API
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
    
    const response = await fetch(url, {
        ...options,
        headers,
    });
    
    // Handle 401 - redirect to login
    if (response.status === 401) {
        clearToken();
        window.location.href = 'index.html';
        throw new Error('Session expired');
    }
    
    // Handle 204 No Content
    if (response.status === 204) {
        return null;
    }
    
    const data = await response.json();
    
    if (!response.ok) {
        // Extract error message from response
        let message = 'Request failed';
        if (data.error) {
            message = data.error;
        } else if (data.detail) {
            message = data.detail;
        } else if (data.username) {
            message = data.username[0];
        } else if (data.password) {
            message = data.password[0];
        } else if (data.non_field_errors) {
            message = data.non_field_errors[0];
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
