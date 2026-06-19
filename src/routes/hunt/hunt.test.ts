import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import { api } from '$lib/api';
import { user } from '$lib/store';
import Hunt from './+page.svelte';

vi.mock('$app/paths', () => ({
	base: ''
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

vi.mock('$lib/crypto', () => ({
	initAgeWasm: vi.fn().mockResolvedValue(undefined),
	getStoredPrivateKey: vi.fn().mockResolvedValue('fake_private_key'),
	decrypt: vi.fn().mockReturnValue('{"rule":{"name":"Test Rule"}}')
}));

vi.mock('$lib/store', () => {
	const { writable } = require('svelte/store');
	return {
		user: writable(null),
		showError: vi.fn().mockImplementation((msg) => console.error("TEST_STORE_ERROR:", msg)),
		showFlash: vi.fn()
	};
});

vi.mock('$lib/api', () => ({
	api: {
		me: vi.fn(),
		listDevices: vi.fn(),
		listLogs: vi.fn(),
		getLogsCount: vi.fn(),
		listTeams: vi.fn(),
		listGroups: vi.fn()
	}
}));

function makeLog(overrides = {}) {
	return {
		id: 1,
		device_id: 101,
		time: '2026-06-12T10:00:00Z',
		severity: 'informational',
		content: 'encrypted_content',
		seen: false,
		alert_resolution: null,
		triage_note: null,
		...overrides
	};
}

describe('Hunt URL Hash Shareable State', () => {
	let originalHash: string;
	let replaceStateSpy: any;

	beforeEach(() => {
		originalHash = window.location.hash;
		window.location.hash = '#q=hunt_hash_query&from=2026-06-04T05%3A00&to=2026-06-05T05%3A00';
		replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
		
		vi.mocked(api.me).mockResolvedValue({
			id: 1,
			email: 'admin@test.local',
			role: 'admin',
			extended_edr_enabled: true,
			has_keys: true
		} as any);
		vi.mocked(api.listDevices).mockResolvedValue([]);
		vi.mocked(api.listTeams).mockResolvedValue([]);
		vi.mocked(api.listGroups).mockResolvedValue([]);
		
		user.set({
			id: 1,
			email: 'admin@test.local',
			role: 'admin',
			extended_edr_enabled: true,
			has_keys: true
		} as any);
	});

	afterEach(() => {
		window.location.hash = originalHash;
		replaceStateSpy.mockRestore();
		vi.clearAllMocks();
	});

	it('loads search query and date times from URL hash on mount', async () => {
		const log = makeLog({ id: 99 });
		vi.mocked(api.listLogs).mockResolvedValue([log] as any);
		vi.mocked(api.getLogsCount).mockResolvedValue({ total_count: 1 });

		render(Hunt);

		await waitFor(() => {
			const queryInput = screen.getByPlaceholderText('e.g., meta.device = "laptop" and alert.event_type = "process"') as HTMLInputElement;
			expect(queryInput.value).toBe('hunt_hash_query');
			
			const fromInput = screen.getByLabelText('Start Time') as HTMLInputElement;
			expect(fromInput.value).toBe('2026-06-04T05:00');

			const toInput = screen.getByLabelText('End Time') as HTMLInputElement;
			expect(toInput.value).toBe('2026-06-05T05:00');
		});
	});

	it('updates URL hash when inputs change reactively', async () => {
		window.location.hash = '';
		const log = makeLog({ id: 99 });
		vi.mocked(api.listLogs).mockResolvedValue([log] as any);
		vi.mocked(api.getLogsCount).mockResolvedValue({ total_count: 1 });

		render(Hunt);

		await waitFor(() => {
			expect(screen.getByPlaceholderText('e.g., meta.device = "laptop" and alert.event_type = "process"')).toBeInTheDocument();
		});

		const queryInput = screen.getByPlaceholderText('e.g., meta.device = "laptop" and alert.event_type = "process"');
		await fireEvent.input(queryInput, { target: { value: 'new_hunt_query' } });

		await waitFor(() => {
			expect(replaceStateSpy).toHaveBeenCalledWith(
				null,
				'',
				expect.stringContaining('q=new_hunt_query')
			);
		});
	});

	it('displays the full JSON including the meta fields', async () => {
		window.location.hash = '';
		const log = makeLog({ id: 99, device_id: 101 });
		vi.mocked(api.listLogs).mockResolvedValue([log] as any);
		vi.mocked(api.getLogsCount).mockResolvedValue({ total_count: 1 });
		vi.mocked(api.listDevices).mockResolvedValue([
			{ id: 101, name: 'Target Laptop', last_seen: new Date().toISOString() }
		] as any);

		render(Hunt);

		await waitFor(() => {
			const pre = document.querySelector('pre');
			expect(pre).toBeInTheDocument();
			const content = pre?.textContent || '';
			expect(content).toContain('"alert_id": 99');
			expect(content).toContain('"device": "Target Laptop"');
			expect(content).toContain('"name": "Test Rule"');
		});
	});

	it('exports logs to JSONL when clicking Export JSONL', async () => {
		window.location.hash = '';
		const log = makeLog({ id: 99, device_id: 101 });
		vi.mocked(api.listLogs).mockResolvedValue([log] as any);
		vi.mocked(api.getLogsCount).mockResolvedValue({ total_count: 1 });
		vi.mocked(api.listDevices).mockResolvedValue([
			{ id: 101, name: 'Target Laptop', last_seen: new Date().toISOString() }
		] as any);

		const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
		const revokeObjectURLMock = vi.fn();
		global.URL.createObjectURL = createObjectURLMock;
		global.URL.revokeObjectURL = revokeObjectURLMock;

		const clickMock = vi.fn();
		const originalCreateElement = document.createElement.bind(document);
		const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
			const el = originalCreateElement(tagName);
			if (tagName.toLowerCase() === 'a') {
				el.click = clickMock;
			}
			return el;
		});

		render(Hunt);

		await waitFor(() => {
			expect(screen.getByText('Export JSONL')).toBeInTheDocument();
		});

		await fireEvent.click(screen.getByText('Export JSONL'));
		expect(createObjectURLMock).toHaveBeenCalled();
		expect(clickMock).toHaveBeenCalled();

		createElementSpy.mockRestore();
	});
});


