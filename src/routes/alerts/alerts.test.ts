import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/svelte';
import Page from './+page.svelte';
import { api } from '$lib/api';
import { initAgeWasm, getStoredPrivateKey } from '$lib/crypto';

vi.mock('$app/paths', () => ({
	base: '/ui'
}));

vi.mock('$lib/api', () => ({
	api: {
		me: vi.fn(),
		listDevices: vi.fn(),
		listLogs: vi.fn(),
		markLogSeen: vi.fn()
	}
}));

vi.mock('$lib/crypto', () => ({
	initAgeWasm: vi.fn(),
	getStoredPrivateKey: vi.fn(),
	decrypt: vi.fn()
}));

describe('Alerts Page Component', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		
		// Reset URL hash
		if (typeof window !== 'undefined') {
			window.location.hash = '';
		}

		vi.mocked(initAgeWasm).mockResolvedValue(undefined);
		vi.mocked(api.me).mockResolvedValue({ id: 1, email: 'admin@example.com', role: 'admin', verified: true, has_keys: true, mfa_required_level: 'none', mfa_setup_missing: false, mfa_configured_level: 'none' });
		vi.mocked(api.listDevices).mockResolvedValue([]);
		vi.mocked(api.listLogs).mockResolvedValue([]);
		vi.mocked(getStoredPrivateKey).mockResolvedValue(null);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('initializes toTime to current time + 1 day', async () => {
		const mockNow = new Date('2026-06-03T16:20:00Z');
		vi.setSystemTime(mockNow);

		render(Page);
		await act();

		// Expand the filter card
		const expandBtn = screen.getByText(/Query & Datetime Filter/i);
		await fireEvent.click(expandBtn);
		await act();

		const toInput = screen.getByLabelText('To') as HTMLInputElement;
		// Since timezone offsets can affect formatForDateTimeLocal output in different test runners,
		// we check using a dynamically formatted expected string matching timezone representation.
		const expectedTo = '2026-06-04T16:20';
		
		// Let's format the mockNow + 1 day manually using the local formatting function logic to compare
		const pad = (num: number) => String(num).padStart(2, '0');
		const targetDate = new Date(mockNow.getTime() + 24 * 60 * 60 * 1000);
		const formattedTarget = `${targetDate.getFullYear()}-${pad(targetDate.getMonth() + 1)}-${pad(targetDate.getDate())}T${pad(targetDate.getHours())}:${pad(targetDate.getMinutes())}`;

		expect(toInput.value).toBe(formattedTarget);
	});

	it('moves toTime every hour by default', async () => {
		const mockNow = new Date('2026-06-03T16:20:00Z');
		vi.setSystemTime(mockNow);

		render(Page);
		await act();

		// Expand the filter card
		const expandBtn = screen.getByText(/Query & Datetime Filter/i);
		await fireEvent.click(expandBtn);
		await act();

		const toInput = screen.getByLabelText('To') as HTMLInputElement;
		const pad = (num: number) => String(num).padStart(2, '0');
		const targetDate1 = new Date(mockNow.getTime() + 24 * 60 * 60 * 1000);
		const expectedInitial = `${targetDate1.getFullYear()}-${pad(targetDate1.getMonth() + 1)}-${pad(targetDate1.getDate())}T${pad(targetDate1.getHours())}:${pad(targetDate1.getMinutes())}`;
		expect(toInput.value).toBe(expectedInitial);

		// Fast-forward 1 hour (3600000 ms) - this advances both timers and the fake system clock
		const hourMs = 3600000;
		await act(async () => {
			vi.advanceTimersByTime(hourMs);
		});

		// At mockNow + 1 hour, Date.now() should have moved by 1 hour.
		// The new expectedTo is (mockNow + 1 hour) + 24 hours
		const targetDate2 = new Date(mockNow.getTime() + hourMs + 24 * 60 * 60 * 1000);
		const expectedAfterHour = `${targetDate2.getFullYear()}-${pad(targetDate2.getMonth() + 1)}-${pad(targetDate2.getDate())}T${pad(targetDate2.getHours())}:${pad(targetDate2.getMinutes())}`;
		expect(toInput.value).toBe(expectedAfterHour);
	});

	it('does not move toTime hourly if user explicitly changed setting', async () => {
		const mockNow = new Date('2026-06-03T16:20:00Z');
		vi.setSystemTime(mockNow);

		render(Page);
		await act();

		// Expand the filter card
		const expandBtn = screen.getByText(/Query & Datetime Filter/i);
		await fireEvent.click(expandBtn);
		await act();

		const toInput = screen.getByLabelText('To') as HTMLInputElement;

		// Simulate explicit user change using input event to trigger Svelte bindings
		await fireEvent.input(toInput, { target: { value: '2026-06-05T12:00' } });
		await act();

		expect(toInput.value).toBe('2026-06-05T12:00');

		// Fast-forward 1 hour
		await act(async () => {
			vi.advanceTimersByTime(3600000);
		});

		// It should NOT change
		expect(toInput.value).toBe('2026-06-05T12:00');
	});

	it('uses unencrypted severity as default for meta.severity and severity_number', async () => {
		vi.mocked(api.listLogs).mockResolvedValue([
			{
				id: 42,
				device_id: 1,
				time: '2026-06-03T16:20:00Z',
				severity: 'high',
				content: 'encrypted_content',
				seen: false,
				signature: 'sig'
			}
		]);

		const { container } = render(Page);
		
		await waitFor(() => {
			expect(screen.queryByText(/Loading alerts…/i)).toBeNull();
		});

		// Check that the alert is displayed with unencrypted high severity meta
		const pre = container.querySelector('pre');
		expect(pre).not.toBeNull();
		expect(pre?.textContent).toContain('"severity": "high"');
		expect(pre?.textContent).toContain('"severity_number": 4');
	});

	it('prefers decrypted severity over unencrypted severity', async () => {
		vi.mocked(api.listLogs).mockResolvedValue([
			{
				id: 43,
				device_id: 1,
				time: '2026-06-03T16:20:00Z',
				severity: 'high',
				content: 'encrypted_content',
				seen: false,
				signature: 'sig'
			}
		]);
		vi.mocked(getStoredPrivateKey).mockResolvedValue('fake_key');
		const { decrypt } = await import('$lib/crypto');
		vi.mocked(decrypt).mockReturnValue(JSON.stringify({ severity: 'low', message: 'test' }));

		const { container } = render(Page);

		await waitFor(() => {
			expect(screen.queryByText(/Loading alerts…/i)).toBeNull();
		});

		// It should use the decrypted low severity
		const pre = container.querySelector('pre');
		expect(pre).not.toBeNull();
		expect(pre?.textContent).toContain('"severity": "low"');
		expect(pre?.textContent).toContain('"severity_number": 2');
	});
});
