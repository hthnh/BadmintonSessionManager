// Filename: static/app.js
// (Restored 100% from original ...7457... version)

/*
This is the main entry point for all JavaScript modules.
It acts as a client-side router, loading the specific
manager module required for the current page.
*/

import initDashboard from './modules/dashboard-manager.js';
import initPlayerManager from './modules/player-manager.js';
import initCourtManager from './modules/court-manager.js';
import initSettingsManager from './modules/settings-manager.js';
import initHistoryManager from './modules/history-manager.js';
import initCreateManager from './modules/create-manager.js';

/**
 * Updates the digital clock in the sidebar.
 */
function updateClock() {
    const clockElement = document.getElementById('clock');
    if (clockElement) {
        clockElement.textContent = new Date().toLocaleTimeString('vi-VN');
    }
}

/**
 * Main initialization logic.
 * Runs when the DOM is fully loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    // Route based on the current page path
    if (path === '/') {
        // This will now run the restored dashboard-manager.js
        initDashboard();
    } else if (path === '/manage-players') {
        initPlayerManager();
    } else if (path === '/manage-courts') {
        initCourtManager();
    } else if (path === '/settings') {
        initSettingsManager();
    } else if (path === '/history') {
        initHistoryManager();
    } else if (path === '/create') {
        initCreateManager();
    }

    // Initialize and update the clock
    updateClock();
    setInterval(updateClock, 1000);
});