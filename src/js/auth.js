/**
 * Authentication page logic
 * Handles login and registration forms
 */

import { api, isAuthenticated } from './api.js';

// Check if already authenticated
if (isAuthenticated()) {
    window.location.href = 'board.html';
}

// DOM elements
const loginCard = document.getElementById('login-card');
const registerCard = document.getElementById('register-card');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');
const loginSubmit = document.getElementById('login-submit');
const registerSubmit = document.getElementById('register-submit');

// Toggle between login and register
document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    loginCard.style.display = 'none';
    registerCard.style.display = 'block';
    loginError.classList.remove('show');
    registerError.classList.remove('show');
});

document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    registerCard.style.display = 'none';
    loginCard.style.display = 'block';
    loginError.classList.remove('show');
    registerError.classList.remove('show');
});

// Login form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    loginError.classList.remove('show');
    loginSubmit.disabled = true;
    loginSubmit.textContent = 'Signing in...';
    
    try {
        await api.login(username, password);
        window.location.href = 'board.html';
    } catch (error) {
        loginError.textContent = error.message || 'Login failed';
        loginError.classList.add('show');
    } finally {
        loginSubmit.disabled = false;
        loginSubmit.textContent = 'Sign In';
    }
});

// Register form submission
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const passwordConfirm = document.getElementById('register-password-confirm').value;
    
    // Client-side validation
    if (password !== passwordConfirm) {
        registerError.textContent = 'Passwords do not match';
        registerError.classList.add('show');
        return;
    }
    
    registerError.classList.remove('show');
    registerSubmit.disabled = true;
    registerSubmit.textContent = 'Creating account...';
    
    try {
        await api.register(username, password, email || null);
        window.location.href = 'board.html';
    } catch (error) {
        registerError.textContent = error.message || 'Registration failed';
        registerError.classList.add('show');
    } finally {
        registerSubmit.disabled = false;
        registerSubmit.textContent = 'Create Account';
    }
});
