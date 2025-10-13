// static/modules/toast.js

/**
 * Displays a toast notification on the screen.
 * @param {string} message The message to display.
 * @param {string} type The type of toast ('success', 'error', 'info').
 * @param {number} duration The duration in milliseconds for the toast to be visible.
 */
export function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.error('Toast container element not found!');
        return;
    }

    const toast = document.createElement('div');
    // Base classes and the type-specific class
    toast.className = `toast toast--${type}`;
    toast.textContent = message;

    // Add to the container
    container.appendChild(toast);

    // Animate in
    // We use a tiny timeout to ensure the element is in the DOM before adding the 'visible' class,
    // which allows the CSS transition to trigger correctly.
    setTimeout(() => {
        toast.classList.add('toast--visible');
    }, 10);

    // Set timeout to automatically remove the toast
    setTimeout(() => {
        toast.classList.remove('toast--visible');
        
        // Remove the element from the DOM after the fade-out transition has finished.
        toast.addEventListener('transitionend', () => {
            if (toast.parentElement) {
                toast.remove();
            }
        });
    }, duration);
}