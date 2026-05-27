import { writable } from 'svelte/store';

/** Current user info */
export const user = writable(null);

/** App-wide loading state */
export const loading = writable(false);

/** Flash messages */
export const flash = writable(null);

export function showFlash(message, type = 'success') {
	flash.set({ message, type });
	setTimeout(() => flash.set(null), 5000);
}

export function showError(message) {
	showFlash(message, 'danger');
}
