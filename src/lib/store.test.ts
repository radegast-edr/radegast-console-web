import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { user, loading, flash, showFlash, showError } from './store';

describe('store', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		user.set(null);
		loading.set(false);
		flash.set(null);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('has default store values', () => {
		expect(get(user)).toBeNull();
		expect(get(loading)).toBe(false);
		expect(get(flash)).toBeNull();
	});

	it('updates stores correctly', () => {
		user.set({
			id: 1,
			email: 'test@example.com',
			role: 'admin',
			verified: true,
			has_keys: true,
			mfa_required_level: 'none',
			mfa_setup_missing: false,
			mfa_configured_level: 'none',
			extended_edr_enabled: false,
			api_keys_enabled: false,
			notification_level: 'medium',
			ai_analysis_tool: 'lumo-guest'
		});
		expect(get(user)).toEqual(expect.objectContaining({ id: 1, email: 'test@example.com' }));

		loading.set(true);
		expect(get(loading)).toBe(true);
	});

	it('shows a flash message and clears it after 5 seconds', () => {
		showFlash('Hello success', 'success');
		expect(get(flash)).toEqual({ message: 'Hello success', type: 'success' });

		// Fast forward 4.9 seconds - should still be there
		vi.advanceTimersByTime(4900);
		expect(get(flash)).toEqual({ message: 'Hello success', type: 'success' });

		// Fast forward to 5 seconds
		vi.advanceTimersByTime(100);
		expect(get(flash)).toBeNull();
	});

	it('shows an error message and clears it after 5 seconds', () => {
		showError('Some error occurred');
		expect(get(flash)).toEqual({ message: 'Some error occurred', type: 'danger' });

		vi.advanceTimersByTime(5000);
		expect(get(flash)).toBeNull();
	});

	it('ignores "Not authenticated" error messages', () => {
		showError('Failed to initialize: Not authenticated');
		expect(get(flash)).toBeNull();

		showError('not authenticated');
		expect(get(flash)).toBeNull();
	});
});
