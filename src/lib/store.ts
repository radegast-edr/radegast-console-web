import { writable } from 'svelte/store';
import type { UserInfo } from './api';

export interface FlashMessage {
	message: string;
	type: string;
}

/** Current user info */
export const user = writable<UserInfo | null>(null);

/** App-wide loading state */
export const loading = writable<boolean>(false);

/** Flash messages */
export const flash = writable<FlashMessage | null>(null);

/** Store or trigger to request a key refresh check */
export const triggerKeyRefresh = writable<number>(0);

export function showFlash(message: string, type: string = 'success'): void {
	flash.set({ message, type });
	setTimeout(() => flash.set(null), 5000);
}

export function showError(message: string): void {
	if (message && (message.includes('Not authenticated') || message.includes('not authenticated'))) {
		return;
	}
	showFlash(message, 'danger');
}
