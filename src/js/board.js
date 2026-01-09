/**
 * ADHD Kanban Board - Main Board Logic
 * Uses document-level event delegation for reliable drag-drop
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    if (!isAuthenticated()) {
        window.location.href = 'index.html';
        return;
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
        if (loadingState) loadingState.style.display = 'flex';
        if (errorState) errorState.style.display = 'none';
        if (kanbanBoard) kanbanBoard.style.display = 'none';
    }

    function showError(message) {
        if (loadingState) loadingState.style.display = 'none';
        if (errorState) errorState.style.display = 'flex';
        if (kanbanBoard) kanbanBoard.style.display = 'none';
        if (errorMessage) errorMessage.textContent = message;
    }

    function showBoard() {
        if (loadingState) loadingState.style.display = 'none';
        if (errorState) errorState.style.display = 'none';
        if (kanbanBoard) kanbanBoard.style.display = 'flex';
    }

    function updateColumnLimitUI() {
        if (columns.length >= MAX_COLUMNS) {
            if (addColumnBtn) addColumnBtn.disabled = true;
            if (columnLimitMsg) columnLimitMsg.classList.add('show');
        } else {
            if (addColumnBtn) addColumnBtn.disabled = false;
            if (columnLimitMsg) columnLimitMsg.classList.remove('show');
        }
    }

    function updateColumnSelect() {
        const select = document.getElementById('task-column');
        if (select) {
            select.innerHTML = columns.map(col => 
                `<option value="${col.id}">${escapeHtml(col.name)}</option>`
            ).join('');
        }
    }

    function updateColumnTaskCount(columnId) {
        const column = columns.find(c => c.id === columnId);
        if (column) {
            const titleEl = document.querySelector(`.column[data-column-id="${columnId}"] .column-title`);
            if (titleEl) {
                titleEl.textContent = `${column.name} (${column.tasks ? column.tasks.length : 0})`;
            }
        }
    }

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
        
        return div;
    }

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
        
        if (column.tasks && column.tasks.length > 0) {
            column.tasks.forEach(task => {
                tasksContainer.appendChild(createTaskElement(task));
            });
        } else {
            tasksContainer.innerHTML = '<div class="empty-column" role="note">No tasks yet</div>';
        }
        
        return div;
    }

    function renderBoard() {
        if (!kanbanBoard) return;
        kanbanBoard.innerHTML = '';
        columns.forEach((column, index) => {
            kanbanBoard.appendChild(createColumnElement(column, index));
        });
        updateColumnLimitUI();
        updateColumnSelect();
    }

    async function loadBoard() {
        showLoading();
        
        try {
            currentUser = await api.getCurrentUser();
            if (usernameDisplay) usernameDisplay.textContent = currentUser.username;
            
            const data = await api.getBoard();
            columns = data.columns;
            
            renderBoard();
            showBoard();
        } catch (error) {
            console.error('Failed to load board:', error);
            showError(error.message || 'Failed to load board');
        }
    }

    function startColumnRename(column, titleEl) {
        const currentName = column.name;
        const taskCount = column.tasks ? column.tasks.length : 0;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.className = 'column-rename-input';
        
        titleEl.innerHTML = '';
        titleEl.appendChild(input);
        input.focus();
        input.select();
        
        async function finishRename() {
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                try {
                    await api.updateColumn(column.id, newName);
                    column.name = newName;
                    titleEl.textContent = `${newName} (${taskCount})`;
                } catch (error) {
                    console.error('Failed to rename column:', error);
                    titleEl.textContent = `${currentName} (${taskCount})`;
                }
            } else {
                titleEl.textContent = `${currentName} (${taskCount})`;
            }
        }
        
        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') input.blur();
            else if (e.key === 'Escape') { input.value = currentName; input.blur(); }
        });
    }

    async function handleDeleteColumn(column) {
        const msg = column.tasks && column.tasks.length > 0
            ? `Delete "${column.name}" and its ${column.tasks.length} task(s)?`
            : `Delete column "${column.name}"?`;
        
        if (!confirm(msg)) return;
        
        try {
            await api.deleteColumn(column.id);
            columns = columns.filter(c => c.id !== column.id);
            renderBoard();
        } catch (error) {
            console.error('Failed to delete column:', error);
            alert('Failed to delete column: ' + error.message);
        }
    }

    async function handleDeleteTask(task) {
        if (!confirm(`Delete task "${task.title}"?`)) return;
        
        try {
            await api.deleteTask(task.id);
            for (const column of columns) {
                const index = column.tasks.findIndex(t => t.id === task.id);
                if (index !== -1) { column.tasks.splice(index, 1); break; }
            }
            renderBoard();
        } catch (error) {
            console.error('Failed to delete task:', error);
            alert('Failed to delete task: ' + error.message);
        }
    }

    function openEditTaskModal(task) {
        const idEl = document.getElementById('edit-task-id');
        const titleEl = document.getElementById('edit-task-title');
        const descEl = document.getElementById('edit-task-description');
        if (idEl) idEl.value = task.id;
        if (titleEl) titleEl.value = task.title;
        if (descEl) descEl.value = task.description || '';
        if (editTaskModal) editTaskModal.classList.add('show');
    }

    function openModal(modal) { if (modal) modal.classList.add('show'); }
    function closeModal(modal) { if (modal) modal.classList.remove('show'); }

    // DRAG AND DROP - Document level
    document.addEventListener('mousedown', function(e) {
        if (e.target.classList.contains('drag-handle')) {
            const header = e.target.closest('.column-header');
            if (header) header.setAttribute('draggable', 'true');
        }
    });

    document.addEventListener('mouseup', function(e) {
        document.querySelectorAll('.column-header').forEach(h => h.removeAttribute('draggable'));
    });

    document.addEventListener('dragstart', function(e) {
        if (e.target.classList.contains('task')) {
            const columnEl = e.target.closest('.column');
            draggedTask = {
                element: e.target,
                taskId: parseInt(e.target.dataset.taskId),
                columnId: parseInt(columnEl.dataset.columnId)
            };
            e.target.classList.add('dragging');
            e.target.setAttribute('aria-grabbed', 'true');
            e.dataTransfer.setData('text/plain', e.target.dataset.taskId);
            e.dataTransfer.effectAllowed = 'move';
        }
        if (e.target.classList.contains('column-header')) {
            const column = e.target.closest('.column');
            if (column) {
                draggedColumn = column;
                column.classList.add('column-dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', column.innerHTML);
            }
        }
    });

    document.addEventListener('dragend', function(e) {
        if (e.target.classList.contains('task')) {
            e.target.classList.remove('dragging');
            e.target.setAttribute('aria-grabbed', 'false');
            document.querySelectorAll('.column').forEach(c => c.classList.remove('drag-over'));
            document.querySelectorAll('.task').forEach(t => t.classList.remove('drag-over-task'));
            draggedTask = null;
        }
        if (e.target.classList.contains('column-header')) {
            const column = e.target.closest('.column');
            if (column) column.classList.remove('column-dragging');
            document.querySelectorAll('.column').forEach(c => c.classList.remove('column-drag-over'));
            draggedColumn = null;
        }
    });

    document.addEventListener('dragover', function(e) {
        if (draggedTask && !draggedColumn) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        }
        if (draggedColumn && !draggedTask) {
            const targetColumn = e.target.closest('.column');
            if (targetColumn && targetColumn !== draggedColumn) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            }
        }
    });

    document.addEventListener('dragenter', function(e) {
        if (draggedTask && !draggedColumn) {
            const targetTask = e.target.closest('.task');
            if (targetTask && targetTask !== draggedTask.element) {
                document.querySelectorAll('.task').forEach(t => t.classList.remove('drag-over-task'));
                targetTask.classList.add('drag-over-task');
            }
            const column = e.target.closest('.column');
            if (column) {
                document.querySelectorAll('.column').forEach(c => c.classList.remove('drag-over'));
                column.classList.add('drag-over');
            }
        }
        if (draggedColumn && !draggedTask) {
            const targetColumn = e.target.closest('.column');
            if (targetColumn && targetColumn !== draggedColumn) {
                targetColumn.classList.add('column-drag-over');
            }
        }
    });

    document.addEventListener('dragleave', function(e) {
        if (draggedColumn && !draggedTask) {
            const targetColumn = e.target.closest('.column');
            if (targetColumn && e.target === targetColumn) {
                targetColumn.classList.remove('column-drag-over');
            }
        }
    });

    document.addEventListener('drop', async function(e) {
        if (draggedTask && !draggedColumn) {
            e.preventDefault();
            const column = e.target.closest('.column');
            if (!column) return;
            
            const tasksContainer = column.querySelector('.tasks');
            const toColumnId = parseInt(column.dataset.columnId);
            const fromColumnId = draggedTask.columnId;
            const taskId = draggedTask.taskId;
            
            const emptyMsg = tasksContainer.querySelector('.empty-column');
            if (emptyMsg) emptyMsg.remove();
            
            const targetTask = e.target.closest('.task');
            
            if (fromColumnId === toColumnId) {
                if (targetTask && targetTask !== draggedTask.element) {
                    const allTasks = Array.from(tasksContainer.querySelectorAll('.task'));
                    const draggedIndex = allTasks.indexOf(draggedTask.element);
                    const targetIndex = allTasks.indexOf(targetTask);
                    
                    if (draggedIndex < targetIndex) {
                        targetTask.parentNode.insertBefore(draggedTask.element, targetTask.nextSibling);
                    } else {
                        targetTask.parentNode.insertBefore(draggedTask.element, targetTask);
                    }
                    
                    const newOrder = Array.from(tasksContainer.querySelectorAll('.task')).map((t, i) => ({
                        id: parseInt(t.dataset.taskId), order: i + 1
                    }));
                    
                    try {
                        await api.reorderTasks(newOrder);
                        const col = columns.find(c => c.id === toColumnId);
                        if (col) {
                            col.tasks.sort((a, b) => {
                                const aO = newOrder.find(o => o.id === a.id);
                                const bO = newOrder.find(o => o.id === b.id);
                                return (aO?.order || 0) - (bO?.order || 0);
                            });
                        }
                    } catch (err) { console.error('Failed to reorder:', err); loadBoard(); }
                }
            } else {
                if (targetTask) targetTask.parentNode.insertBefore(draggedTask.element, targetTask);
                else tasksContainer.appendChild(draggedTask.element);
                
                try {
                    await api.moveTask(taskId, toColumnId);
                    const fromCol = columns.find(c => c.id === fromColumnId);
                    const toCol = columns.find(c => c.id === toColumnId);
                    if (fromCol && toCol) {
                        const idx = fromCol.tasks.findIndex(t => t.id === taskId);
                        if (idx !== -1) {
                            const task = fromCol.tasks.splice(idx, 1)[0];
                            task.column = toColumnId;
                            toCol.tasks.push(task);
                        }
                    }
                    updateColumnTaskCount(fromColumnId);
                    updateColumnTaskCount(toColumnId);
                    if (fromCol && fromCol.tasks.length === 0) {
                        const fc = document.querySelector(`.column[data-column-id="${fromColumnId}"] .tasks`);
                        if (fc && !fc.querySelector('.empty-column')) {
                            fc.innerHTML = '<div class="empty-column" role="note">No tasks yet</div>';
                        }
                    }
                } catch (err) { console.error('Failed to move:', err); loadBoard(); }
            }
            document.querySelectorAll('.column').forEach(c => c.classList.remove('drag-over'));
            document.querySelectorAll('.task').forEach(t => t.classList.remove('drag-over-task'));
        }
        
        if (draggedColumn && !draggedTask) {
            e.preventDefault();
            const targetColumn = e.target.closest('.column');
            if (!targetColumn || targetColumn === draggedColumn) return;
            targetColumn.classList.remove('column-drag-over');
            
            const allCols = Array.from(kanbanBoard.querySelectorAll('.column'));
            const dIdx = allCols.indexOf(draggedColumn);
            const tIdx = allCols.indexOf(targetColumn);
            
            if (dIdx < tIdx) targetColumn.parentNode.insertBefore(draggedColumn, targetColumn.nextSibling);
            else targetColumn.parentNode.insertBefore(draggedColumn, targetColumn);
            
            const newOrder = Array.from(kanbanBoard.querySelectorAll('.column')).map((c, i) => ({
                id: parseInt(c.dataset.columnId), order: i + 1
            }));
            
            try {
                await api.reorderColumns(newOrder);
                columns = newOrder.map(o => columns.find(c => c.id === o.id));
            } catch (err) { console.error('Failed to reorder columns:', err); renderBoard(); }
        }
    });

    // Click handlers
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('task-edit')) {
            e.stopPropagation();
            const taskId = parseInt(e.target.dataset.taskId);
            for (const col of columns) {
                const task = col.tasks.find(t => t.id === taskId);
                if (task) { openEditTaskModal(task); break; }
            }
        }
        if (e.target.classList.contains('task-delete')) {
            e.stopPropagation();
            const taskId = parseInt(e.target.dataset.taskId);
            for (const col of columns) {
                const task = col.tasks.find(t => t.id === taskId);
                if (task) { handleDeleteTask(task); break; }
            }
        }
        if (e.target.classList.contains('delete-column')) {
            const colId = parseInt(e.target.dataset.columnId);
            const col = columns.find(c => c.id === colId);
            if (col) handleDeleteColumn(col);
        }
    });

    document.addEventListener('dblclick', function(e) {
        if (e.target.classList.contains('column-title')) {
            const colId = parseInt(e.target.dataset.columnId);
            const col = columns.find(c => c.id === colId);
            if (col) startColumnRename(col, e.target);
        }
    });

    // UI handlers
    if (userMenuBtn) userMenuBtn.addEventListener('click', () => { if (userDropdown) userDropdown.classList.toggle('show'); });
    
    document.addEventListener('click', (e) => {
        if (userMenuBtn && userDropdown && !userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
            userDropdown.classList.remove('show');
        }
    });

    if (logoutBtn) logoutBtn.addEventListener('click', () => { api.logout(); window.location.href = 'index.html'; });
    
    if (addColumnBtn) addColumnBtn.addEventListener('click', () => {
        if (columns.length >= MAX_COLUMNS) { alert('Maximum of 12 columns reached'); return; }
        openModal(columnModal);
    });

    const addTaskBtn = document.getElementById('add-task-btn');
    if (addTaskBtn) addTaskBtn.addEventListener('click', () => openModal(taskModal));

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.closest('.modal')));
    });

    const cancelTaskBtn = document.getElementById('cancel-task-btn');
    if (cancelTaskBtn) cancelTaskBtn.addEventListener('click', () => closeModal(taskModal));
    const cancelColumnBtn = document.getElementById('cancel-column-btn');
    if (cancelColumnBtn) cancelColumnBtn.addEventListener('click', () => closeModal(columnModal));
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => closeModal(editTaskModal));

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); });
    });

    const taskForm = document.getElementById('task-form');
    if (taskForm) {
        taskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('task-title').value.trim();
            const description = document.getElementById('task-description').value.trim();
            const columnId = parseInt(document.getElementById('task-column').value);
            if (!title) return;
            try {
                const newTask = await api.createTask(columnId, title, description);
                const col = columns.find(c => c.id === columnId);
                if (col) col.tasks.push(newTask);
                closeModal(taskModal);
                taskForm.reset();
                renderBoard();
            } catch (err) { console.error('Failed to create task:', err); alert('Failed: ' + err.message); }
        });
    }

    const columnForm = document.getElementById('column-form');
    if (columnForm) {
        columnForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('column-name').value.trim();
            if (!name) return;
            try {
                const newCol = await api.createColumn(name);
                newCol.tasks = [];
                columns.push(newCol);
                closeModal(columnModal);
                columnForm.reset();
                renderBoard();
            } catch (err) { console.error('Failed to create column:', err); alert('Failed: ' + err.message); }
        });
    }

    const editTaskForm = document.getElementById('edit-task-form');
    if (editTaskForm) {
        editTaskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const taskId = parseInt(document.getElementById('edit-task-id').value);
            const title = document.getElementById('edit-task-title').value.trim();
            const description = document.getElementById('edit-task-description').value.trim();
            if (!title) return;
            try {
                const updated = await api.updateTask(taskId, title, description);
                for (const col of columns) {
                    const task = col.tasks.find(t => t.id === taskId);
                    if (task) { task.title = updated.title; task.description = updated.description; break; }
                }
                closeModal(editTaskModal);
                editTaskForm.reset();
                renderBoard();
            } catch (err) { console.error('Failed to update task:', err); alert('Failed: ' + err.message); }
        });
    }

    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) retryBtn.addEventListener('click', loadBoard);

    // Initialize
    loadBoard();
});
