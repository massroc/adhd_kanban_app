/**
 * Board Logic for ADHD Kanban
 * Handles rendering, drag-and-drop, and all board interactions
 */

import { api, isAuthenticated } from './api.js';

// Check authentication
if (!isAuthenticated()) {
    window.location.href = 'index.html';
}

// State
let currentUser = null;
let columns = [];
let draggedColumn = null;
let draggedTask = null;

const MAX_COLUMNS = 12;

// DOM Elements
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const kanbanBoard = document.getElementById('kanban-board');
const addColumnBtn = document.getElementById('add-column-btn');
const columnLimitMsg = document.getElementById('column-limit-msg');
const usernameDisplay = document.getElementById('username-display');
const userMenuBtn = document.getElementById('user-menu-btn');
const userDropdown = document.getElementById('user-dropdown');
const logoutBtn = document.getElementById('logout-btn');

// Modals
const taskModal = document.getElementById('task-modal');
const columnModal = document.getElementById('column-modal');
const editTaskModal = document.getElementById('edit-task-modal');

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Show/hide states
function showLoading() {
    loadingState.style.display = 'flex';
    errorState.style.display = 'none';
    kanbanBoard.style.display = 'none';
}

function showError(message) {
    loadingState.style.display = 'none';
    errorState.style.display = 'flex';
    kanbanBoard.style.display = 'none';
    errorMessage.textContent = message;
}

function showBoard() {
    loadingState.style.display = 'none';
    errorState.style.display = 'none';
    kanbanBoard.style.display = 'flex';
}

// Update column limit UI
function updateColumnLimitUI() {
    if (columns.length >= MAX_COLUMNS) {
        addColumnBtn.disabled = true;
        columnLimitMsg.classList.add('show');
    } else {
        addColumnBtn.disabled = false;
        columnLimitMsg.classList.remove('show');
    }
}

// Update column select dropdown
function updateColumnSelect() {
    const select = document.getElementById('task-column');
    select.innerHTML = columns.map(col => 
        `<option value="${col.id}">${escapeHtml(col.name)}</option>`
    ).join('');
}

// Create task element
function createTaskElement(task) {
    const div = document.createElement('div');
    div.className = 'task';
    div.dataset.taskId = task.id;
    div.dataset.order = task.order;
    div.draggable = true;
    div.setAttribute('role', 'listitem');
    div.setAttribute('aria-grabbed', 'false');
    
    div.innerHTML = `
        <div class="task-controls">
            <button class="task-edit" data-task-id="${task.id}" aria-label="Edit task" title="Edit task">✎</button>
            <button class="task-delete" data-task-id="${task.id}" aria-label="Delete task" title="Delete task">×</button>
        </div>
        <div class="task-title">${escapeHtml(task.title)}</div>
        ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
        <div class="task-meta">${formatDate(task.created_at)}</div>
    `;
    
    // Task drag events
    div.addEventListener('dragstart', handleTaskDragStart);
    div.addEventListener('dragend', handleTaskDragEnd);
    
    // Edit task on double-click title
    div.querySelector('.task-title').addEventListener('dblclick', () => openEditTaskModal(task));
    
    // Edit button
    div.querySelector('.task-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditTaskModal(task);
    });
    
    // Delete button
    div.querySelector('.task-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        handleDeleteTask(task);
    });
    
    return div;
}

// Create column element
function createColumnElement(column, index) {
    const div = document.createElement('div');
    div.className = 'column';
    div.dataset.columnId = column.id;
    div.dataset.columnOrder = column.order;
    div.setAttribute('role', 'region');
    div.setAttribute('aria-labelledby', `column-header-${column.id}`);
    
    const taskCount = column.tasks ? column.tasks.length : 0;
    
    div.innerHTML = `
        <div id="column-header-${column.id}" class="column-header">
            <span class="drag-handle" title="Drag to reorder">⋮</span>
            <div class="column-title" data-column-id="${column.id}">
                ${escapeHtml(column.name)} (${taskCount})
            </div>
            <div class="column-controls">
                <button class="delete-column" data-column-id="${column.id}" aria-label="Delete column" title="Delete column">×</button>
            </div>
        </div>
        <div class="tasks" role="list"></div>
    `;
    
    const tasksContainer = div.querySelector('.tasks');
    
    // Add tasks
    if (column.tasks && column.tasks.length > 0) {
        column.tasks.forEach(task => {
            tasksContainer.appendChild(createTaskElement(task));
        });
    } else {
        tasksContainer.innerHTML = '<div class="empty-column" role="note">No tasks yet</div>';
    }
    
    // Column drag events (via handle)
    const header = div.querySelector('.column-header');
    const handle = div.querySelector('.drag-handle');
    
    handle.addEventListener('mousedown', () => {
        header.setAttribute('draggable', 'true');
    });
    
    document.addEventListener('mouseup', () => {
        header.removeAttribute('draggable');
    });
    
    header.addEventListener('dragstart', (e) => handleColumnDragStart(e, column, div));
    header.addEventListener('dragend', handleColumnDragEnd);
    
    // Column drop target for tasks
    div.addEventListener('dragover', handleColumnDragOver);
    div.addEventListener('dragenter', handleColumnDragEnter);
    div.addEventListener('dragleave', handleColumnDragLeave);
    div.addEventListener('drop', (e) => handleColumnDrop(e, column));
    
    // Rename column on double-click
    const titleEl = div.querySelector('.column-title');
    titleEl.addEventListener('dblclick', () => startColumnRename(column, titleEl));
    
    // Delete column
    div.querySelector('.delete-column').addEventListener('click', () => handleDeleteColumn(column));
    
    return div;
}

// Render the board
function renderBoard() {
    kanbanBoard.innerHTML = '';
    columns.forEach((column, index) => {
        kanbanBoard.appendChild(createColumnElement(column, index));
    });
    updateColumnLimitUI();
    updateColumnSelect();
}

// Load board data
async function loadBoard() {
    showLoading();
    
    try {
        // Get user info
        currentUser = await api.getCurrentUser();
        usernameDisplay.textContent = currentUser.username;
        
        // Get board data
        const data = await api.getBoard();
        columns = data.columns;
        
        renderBoard();
        showBoard();
    } catch (error) {
        console.error('Failed to load board:', error);
        showError(error.message || 'Failed to load board');
    }
}

// Column drag and drop
function handleColumnDragStart(e, column, element) {
    draggedColumn = { column, element, index: columns.findIndex(c => c.id === column.id) };
    element.classList.add('column-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', element.innerHTML);
}

function handleColumnDragEnd(e) {
    if (draggedColumn) {
        draggedColumn.element.classList.remove('column-dragging');
    }
    document.querySelectorAll('.column').forEach(col => {
        col.classList.remove('column-drag-over');
    });
    draggedColumn = null;
}

function handleColumnDragOver(e) {
    if (draggedColumn && !draggedTask) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    } else if (draggedTask) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }
}

function handleColumnDragEnter(e) {
    const column = e.currentTarget;
    if (draggedColumn && draggedColumn.element !== column && !draggedTask) {
        column.classList.add('column-drag-over');
    } else if (draggedTask) {
        column.classList.add('drag-over');
    }
}

function handleColumnDragLeave(e) {
    if (e.target === e.currentTarget) {
        e.currentTarget.classList.remove('column-drag-over');
        e.currentTarget.classList.remove('drag-over');
    }
}

async function handleColumnDrop(e, targetColumn) {
    e.preventDefault();
    e.stopPropagation();
    
    const columnEl = e.currentTarget;
    columnEl.classList.remove('column-drag-over');
    columnEl.classList.remove('drag-over');
    
    // Handle column reorder
    if (draggedColumn && draggedColumn.column.id !== targetColumn.id && !draggedTask) {
        const board = kanbanBoard;
        const allColumns = Array.from(board.querySelectorAll('.column'));
        const draggedIndex = allColumns.indexOf(draggedColumn.element);
        const targetIndex = allColumns.indexOf(columnEl);
        
        // Reorder in DOM
        if (draggedIndex < targetIndex) {
            columnEl.parentNode.insertBefore(draggedColumn.element, columnEl.nextSibling);
        } else {
            columnEl.parentNode.insertBefore(draggedColumn.element, columnEl);
        }
        
        // Build new order
        const newOrder = Array.from(board.querySelectorAll('.column')).map((col, index) => ({
            id: parseInt(col.dataset.columnId),
            order: index + 1
        }));
        
        try {
            await api.reorderColumns(newOrder);
            // Update local state
            const reorderedColumns = newOrder.map(o => columns.find(c => c.id === o.id));
            columns = reorderedColumns;
        } catch (error) {
            console.error('Failed to reorder columns:', error);
            renderBoard(); // Reload on failure
        }
    }
    
    // Handle task drop
    if (draggedTask) {
        const taskId = parseInt(draggedTask.element.dataset.taskId);
        const fromColumnId = draggedTask.columnId;
        const toColumnId = targetColumn.id;
        
        if (fromColumnId === toColumnId) {
            // Reorder within same column
            const tasksContainer = columnEl.querySelector('.tasks');
            const dropTarget = e.target.closest('.task');
            
            if (dropTarget && dropTarget !== draggedTask.element) {
                const allTasks = Array.from(tasksContainer.querySelectorAll('.task'));
                const draggedIndex = allTasks.indexOf(draggedTask.element);
                const targetIndex = allTasks.indexOf(dropTarget);
                
                if (draggedIndex < targetIndex) {
                    dropTarget.parentNode.insertBefore(draggedTask.element, dropTarget.nextSibling);
                } else {
                    dropTarget.parentNode.insertBefore(draggedTask.element, dropTarget);
                }
                
                // Build new order
                const newOrder = Array.from(tasksContainer.querySelectorAll('.task')).map((task, index) => ({
                    id: parseInt(task.dataset.taskId),
                    order: index + 1
                }));
                
                try {
                    await api.reorderTasks(newOrder);
                } catch (error) {
                    console.error('Failed to reorder tasks:', error);
                    loadBoard();
                }
            }
        } else {
            // Move to different column
            try {
                await api.moveTask(taskId, toColumnId);
                
                // Update local state
                const fromCol = columns.find(c => c.id === fromColumnId);
                const toCol = columns.find(c => c.id === toColumnId);
                const taskIndex = fromCol.tasks.findIndex(t => t.id === taskId);
                const task = fromCol.tasks.splice(taskIndex, 1)[0];
                task.column = toColumnId;
                toCol.tasks.push(task);
                
                renderBoard();
            } catch (error) {
                console.error('Failed to move task:', error);
                loadBoard();
            }
        }
    }
}

// Task drag and drop
function handleTaskDragStart(e) {
    const taskEl = e.target;
    const columnEl = taskEl.closest('.column');
    draggedTask = {
        element: taskEl,
        columnId: parseInt(columnEl.dataset.columnId)
    };
    taskEl.classList.add('dragging');
    taskEl.setAttribute('aria-grabbed', 'true');
    e.dataTransfer.setData('text/plain', taskEl.dataset.taskId);
    e.dataTransfer.effectAllowed = 'move';
}

function handleTaskDragEnd(e) {
    e.target.classList.remove('dragging');
    e.target.setAttribute('aria-grabbed', 'false');
    document.querySelectorAll('.column').forEach(col => {
        col.classList.remove('drag-over');
    });
    document.querySelectorAll('.task').forEach(task => {
        task.classList.remove('drag-over-task');
    });
    draggedTask = null;
}

// Column rename
function startColumnRename(column, titleEl) {
    const currentName = column.name;
    const taskCount = column.tasks ? column.tasks.length : 0;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'column-rename-input';
    input.value = currentName;
    
    titleEl.innerHTML = '';
    titleEl.appendChild(input);
    input.focus();
    input.select();
    
    async function saveRename() {
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
            try {
                await api.updateColumn(column.id, newName);
                column.name = newName;
            } catch (error) {
                console.error('Failed to rename column:', error);
            }
        }
        titleEl.innerHTML = `${escapeHtml(column.name)} (${taskCount})`;
    }
    
    input.addEventListener('blur', saveRename);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            titleEl.innerHTML = `${escapeHtml(currentName)} (${taskCount})`;
        }
    });
}

// Delete column
async function handleDeleteColumn(column) {
    const taskCount = column.tasks ? column.tasks.length : 0;
    let confirmMsg = `Delete column "${column.name}"?`;
    if (taskCount > 0) {
        confirmMsg = `Delete column "${column.name}" and its ${taskCount} task${taskCount > 1 ? 's' : ''}?`;
    }
    
    if (!confirm(confirmMsg)) return;
    
    try {
        await api.deleteColumn(column.id);
        columns = columns.filter(c => c.id !== column.id);
        renderBoard();
    } catch (error) {
        console.error('Failed to delete column:', error);
        alert('Failed to delete column');
    }
}

// Delete task
async function handleDeleteTask(task) {
    const taskTitle = task.title.length > 30 ? task.title.substring(0, 30) + '...' : task.title;
    
    if (!confirm(`Delete "${taskTitle}"?`)) return;
    
    try {
        await api.deleteTask(task.id);
        
        // Update local state
        for (const column of columns) {
            const index = column.tasks.findIndex(t => t.id === task.id);
            if (index !== -1) {
                column.tasks.splice(index, 1);
                break;
            }
        }
        
        renderBoard();
    } catch (error) {
        console.error('Failed to delete task:', error);
        alert('Failed to delete task');
    }
}

// Move task between columns (used by document-level drop handler)
async function moveTaskToColumn(taskId, newColumnId, oldColumnId) {
    try {
        await api.moveTask(taskId, newColumnId);
        
        // Update local state
        const fromCol = columns.find(c => c.id === oldColumnId);
        const toCol = columns.find(c => c.id === newColumnId);
        const taskIndex = fromCol.tasks.findIndex(t => t.id === taskId);
        const task = fromCol.tasks.splice(taskIndex, 1)[0];
        task.column = newColumnId;
        toCol.tasks.push(task);
        
        renderBoard();
    } catch (error) {
        console.error('Failed to move task:', error);
        loadBoard();
    }
}

// Modal helpers
function openModal(modal) {
    modal.classList.add('active');
}

function closeModal(modal) {
    modal.classList.remove('active');
}

function openEditTaskModal(task) {
    document.getElementById('edit-task-id').value = task.id;
    document.getElementById('edit-task-title').value = task.title;
    document.getElementById('edit-task-description').value = task.description || '';
    openModal(editTaskModal);
    document.getElementById('edit-task-title').focus();
}

// Event Listeners

// User menu
userMenuBtn.addEventListener('click', () => {
    userDropdown.classList.toggle('show');
});

document.addEventListener('click', (e) => {
    if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
        userDropdown.classList.remove('show');
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        await api.logout();
    } finally {
        window.location.href = 'index.html';
    }
});

// Add task button
document.getElementById('add-task-btn').addEventListener('click', () => {
    openModal(taskModal);
    document.getElementById('task-title').focus();
});

// Cancel task button
document.getElementById('cancel-task-btn').addEventListener('click', () => {
    closeModal(taskModal);
    document.getElementById('add-task-form').reset();
});

// Add column button
addColumnBtn.addEventListener('click', () => {
    openModal(columnModal);
    document.getElementById('column-name').focus();
});

// Cancel column button
document.getElementById('cancel-column-btn').addEventListener('click', () => {
    closeModal(columnModal);
    document.getElementById('add-column-form').reset();
});

// Cancel edit button
document.getElementById('cancel-edit-btn').addEventListener('click', () => {
    closeModal(editTaskModal);
    document.getElementById('edit-task-form').reset();
});

// Close modals on overlay click
[taskModal, columnModal, editTaskModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal);
        }
    });
});

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal(taskModal);
        closeModal(columnModal);
        closeModal(editTaskModal);
    }
});

// Add task form
document.getElementById('add-task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('task-title').value.trim();
    const description = document.getElementById('task-description').value.trim();
    const columnId = parseInt(document.getElementById('task-column').value);
    
    if (!title) return;
    
    try {
        const newTask = await api.createTask(title, columnId, description);
        
        // Update local state
        const column = columns.find(c => c.id === columnId);
        if (column) {
            column.tasks.push(newTask);
        }
        
        closeModal(taskModal);
        document.getElementById('add-task-form').reset();
        renderBoard();
    } catch (error) {
        console.error('Failed to create task:', error);
        alert('Failed to create task: ' + error.message);
    }
});

// Add column form
document.getElementById('add-column-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('column-name').value.trim();
    
    if (!name) return;
    
    try {
        const newColumn = await api.createColumn(name);
        newColumn.tasks = [];
        columns.push(newColumn);
        
        closeModal(columnModal);
        document.getElementById('add-column-form').reset();
        renderBoard();
    } catch (error) {
        console.error('Failed to create column:', error);
        alert('Failed to create column: ' + error.message);
    }
});

// Edit task form
document.getElementById('edit-task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const taskId = parseInt(document.getElementById('edit-task-id').value);
    const title = document.getElementById('edit-task-title').value.trim();
    const description = document.getElementById('edit-task-description').value.trim();
    
    if (!title) return;
    
    try {
        const updatedTask = await api.updateTask(taskId, title, description);
        
        // Update local state
        for (const column of columns) {
            const task = column.tasks.find(t => t.id === taskId);
            if (task) {
                task.title = updatedTask.title;
                task.description = updatedTask.description;
                break;
            }
        }
        
        closeModal(editTaskModal);
        document.getElementById('edit-task-form').reset();
        renderBoard();
    } catch (error) {
        console.error('Failed to update task:', error);
        alert('Failed to update task: ' + error.message);
    }
});

// Retry button
document.getElementById('retry-btn').addEventListener('click', loadBoard);

// Initialize
loadBoard();

// Document-level drag handlers for reliable drop zones
document.addEventListener('dragover', function(e) {
    if (draggedTask || draggedColumn) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }
});

document.addEventListener('drop', function(e) {
    if (!draggedTask) return;
    e.preventDefault();
    
    const column = e.target.closest('.column');
    if (!column) return;
    
    const newColumnId = parseInt(column.dataset.columnId);
    const taskId = parseInt(draggedTask.element.dataset.taskId);
    const oldColumnId = draggedTask.columnId;
    
    if (newColumnId !== oldColumnId) {
        moveTaskToColumn(taskId, newColumnId, oldColumnId);
    }
    
    document.querySelectorAll('.column').forEach(col => col.classList.remove('drag-over'));
});

// Export for testing
export { 
    loadBoard, 
    renderBoard, 
    createTaskElement, 
    createColumnElement,
    escapeHtml,
    formatDate,
    MAX_COLUMNS
};
