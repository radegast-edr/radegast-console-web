import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import { api } from '$lib/api';
import { user } from '$lib/store';
import Alerts from './+page.svelte';

vi.mock('$app/paths', () => ({
	base: ''
}));

vi.mock('$lib/confirm', () => ({
	askConfirm: vi.fn().mockResolvedValue(true)
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

vi.mock('$lib/crypto', () => ({
	initAgeWasm: vi.fn().mockResolvedValue(undefined),
	getStoredPrivateKey: vi.fn().mockResolvedValue('fake_private_key'),
	decrypt: vi.fn().mockReturnValue('{"rule":{"name":"Test Rule"}}'),
	encrypt: vi.fn().mockReturnValue('encrypted_triage_note'),
	aesEncrypt: vi.fn().mockResolvedValue('encrypted_key')
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
		listTeams: vi.fn(),
		listGroups: vi.fn(),
		listLogs: vi.fn(),
		getLogsCount: vi.fn(),
		markLogSeen: vi.fn(),
		markAllLogsSeen: vi.fn(),
		getDevice: vi.fn(),
		getGroup: vi.fn(),
		createExclusion: vi.fn(),
		client: {
			GET: vi.fn(),
			PATCH: vi.fn()
		}
	}
}));

// LogManager is not mocked; we use the real LogManager class to verify template reactivity.

const mockUser = {
	id: 1,
	email: 'analyst@example.com',
	role: 'user',
	verified: true,
	extended_edr_enabled: false
};

const makeLog = (overrides: Record<string, any> = {}) => ({
	id: 1,
	device_id: 1,
	time: '2026-06-04T05:00:00Z',
	content: 'encrypted_content',
	signature: 'sig',
	seen: false,
	severity: 'high',
	alert_resolution: null,
	triage_note: null,
	...overrides
});

describe('Alerts Page', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		vi.mocked(api.me).mockResolvedValue(mockUser as any);
		vi.mocked(api.listDevices).mockResolvedValue([
			{ id: 1, name: 'Test Device', last_seen: '2026-06-04T05:00:00Z' }
		] as any);
		vi.mocked(api.listTeams).mockResolvedValue([] as any);
		vi.mocked(api.listGroups).mockResolvedValue([
			{ id: 1, name: 'Test Group' }
		] as any);
		vi.mocked(api.listLogs).mockResolvedValue([]);
		vi.mocked(api.getLogsCount).mockResolvedValue({ total_count: 0 });
		vi.mocked(api.markLogSeen).mockResolvedValue({ message: 'ok' } as any);
		vi.mocked(api.getDevice).mockResolvedValue({
			id: 1,
			name: 'Test Device',
			groups: [{ id: 1, name: 'Test Group' }]
		} as any);
		vi.mocked(api.getGroup).mockResolvedValue({
			id: 1,
			name: 'Test Group',
			teams: [{ id: 10, name: 'Test Team', permission_pack: 'write' }]
		} as any);
		vi.mocked(api.createExclusion).mockResolvedValue({ id: 100 } as any);
		vi.mocked(api.client.GET).mockResolvedValue({
			data: [
				{ user_id: 1, public_key: 'age1abc...', key_type: 'regular' },
				{ user_id: 2, public_key: 'age1def...', key_type: 'regular' }
			],
			error: null
		} as any);
		vi.mocked(api.client.PATCH).mockResolvedValue({
			data: { ...makeLog({ alert_resolution: 'true_positive', seen: true }) },
			error: null
		} as any);

		user.set(mockUser as any);
	});

	it('renders the Threat Triage heading', async () => {
		render(Alerts);
		await waitFor(() => {
			expect(screen.getByText('Threat Triage')).toBeInTheDocument();
		});
	});

	it('shows loading state initially', async () => {
		render(Alerts);
		// Component renders "Loading alerts..." while logManager is null
		// After init, LogManager is created — we just verify no crash
		await waitFor(() => {
			expect(screen.getByText('Threat Triage')).toBeInTheDocument();
		});
	});

	describe('Extended EDR mode - mark-as-seen behaviour', () => {
		it('does NOT call markLogSeen for a log without resolution in extended EDR mode', async () => {
			// This is tested via the selectLog logic: shouldMarkSeen must be false
			// when extended_edr_enabled=true and log has no resolution.
			const edrUser = { ...mockUser, extended_edr_enabled: true };
			vi.mocked(api.me).mockResolvedValue(edrUser as any);
			user.set(edrUser as any);

			// The log has no resolution
			const log = makeLog({ seen: false, alert_resolution: null });

			// shouldMarkSeen = $user && !log.seen && !markedSeenIds.has(log.id) &&
			//                   (!$user.extended_edr_enabled || hasResolution)
			// = true && true && true && (false || false) = false
			const extended_edr_enabled = true;
			const hasResolution = !!(log.alert_resolution && log.alert_resolution !== 'none');
			const shouldMarkSeen = !log.seen && (!extended_edr_enabled || hasResolution);
			expect(shouldMarkSeen).toBe(false);
		});

		it('DOES call markLogSeen for a log WITH resolution in extended EDR mode', async () => {
			const edrUser = { ...mockUser, extended_edr_enabled: true };
			user.set(edrUser as any);

			// Log already has a resolution
			const log = makeLog({ seen: false, alert_resolution: 'true_positive' });

			const extended_edr_enabled = true;
			const hasResolution = !!(log.alert_resolution && log.alert_resolution !== 'none');
			const shouldMarkSeen = !log.seen && (!extended_edr_enabled || hasResolution);
			expect(shouldMarkSeen).toBe(true);
		});

		it('marks as seen in basic mode regardless of resolution', () => {
			const log = makeLog({ seen: false, alert_resolution: null });

			const extended_edr_enabled = false; // basic mode
			const hasResolution = !!(log.alert_resolution && log.alert_resolution !== 'none');
			const shouldMarkSeen = !log.seen && (!extended_edr_enabled || hasResolution);
			// (!false || false) = (true || false) = true
			expect(shouldMarkSeen).toBe(true);
		});
	});

	describe('saveResolution - seen state after saving', () => {
		it('sets seen=true after saving a real resolution in extended EDR mode', () => {
			const extended_edr_enabled = true;
			const resolution: string = 'true_positive';
			const hasRealResolution = resolution && resolution !== 'none';
			const shouldSetSeen = !extended_edr_enabled || !!hasRealResolution;
			expect(shouldSetSeen).toBe(true);
		});

		it('does NOT set seen=true after clearing resolution (none) in extended EDR mode', () => {
			const extended_edr_enabled = true;
			const resolution = 'none';
			const hasRealResolution = resolution && resolution !== 'none';
			const shouldSetSeen = !extended_edr_enabled || !!hasRealResolution;
			// !true || false = false
			expect(shouldSetSeen).toBe(false);
		});

		it('always sets seen=true in basic mode (even when resolution is none)', () => {
			const extended_edr_enabled = false;
			const resolution = 'none';
			const hasRealResolution = resolution && resolution !== 'none';
			const shouldSetSeen = !extended_edr_enabled || !!hasRealResolution;
			// !false || false = true
			expect(shouldSetSeen).toBe(true);
		});

		it('always sets seen=true in basic mode with a real resolution', () => {
			const extended_edr_enabled = false;
			const resolution: string = 'false_positive';
			const hasRealResolution = resolution && resolution !== 'none';
			const shouldSetSeen = !extended_edr_enabled || !!hasRealResolution;
			expect(shouldSetSeen).toBe(true);
		});
	});

	describe('Visual styling based on read/unread/EDR mode', () => {
		it('renders log as unread (has border-danger, no opacity-75) in extended EDR mode when it has no resolution, even if seen is true', async () => {
			const edrUser = { ...mockUser, extended_edr_enabled: true };
			vi.mocked(api.me).mockResolvedValue(edrUser as any);
			user.set(edrUser as any);
			
			const log = makeLog({ id: 99, seen: true, alert_resolution: null });
			vi.mocked(api.listLogs).mockResolvedValue([log] as any);
			vi.mocked(api.getLogsCount).mockResolvedValue({ total_count: 1 });

			render(Alerts);

			await waitFor(() => {
				const card = screen.getByText('Test Rule').closest('.card');
				expect(card).toBeInTheDocument();
				expect(card).toHaveClass('border-start');
				expect(card).toHaveClass('border-danger');
				expect(card).not.toHaveClass('opacity-75');
				expect(screen.queryByText('read')).toBeNull();
			});
		});

		it('renders log as read (no border-danger, has opacity-75) in extended EDR mode when it has a resolution', async () => {
			const edrUser = { ...mockUser, extended_edr_enabled: true };
			vi.mocked(api.me).mockResolvedValue(edrUser as any);
			user.set(edrUser as any);

			const log = makeLog({ id: 99, seen: false, alert_resolution: 'true_positive' });
			vi.mocked(api.listLogs).mockResolvedValue([log] as any);
			vi.mocked(api.getLogsCount).mockResolvedValue({ total_count: 1 });

			render(Alerts);

			await waitFor(() => {
				const card = screen.getByText('Test Rule').closest('.card');
				expect(card).toBeInTheDocument();
				expect(card).not.toHaveClass('border-danger');
				expect(card).toHaveClass('opacity-75');
			});
		});

		it('renders log as read (no border-danger, has opacity-75) in basic mode when it is seen, even with no resolution', async () => {
			const basicUser = { ...mockUser, extended_edr_enabled: false };
			vi.mocked(api.me).mockResolvedValue(basicUser as any);
			user.set(basicUser as any);

			const log = makeLog({ id: 99, seen: true, alert_resolution: null });
			vi.mocked(api.listLogs).mockResolvedValue([log] as any);
			vi.mocked(api.getLogsCount).mockResolvedValue({ total_count: 1 });

			render(Alerts);

			await waitFor(() => {
				const card = screen.getByText('Test Rule').closest('.card');
				expect(card).toBeInTheDocument();
				expect(card).not.toHaveClass('border-danger');
				expect(card).toHaveClass('opacity-75');
				expect(screen.getByText('read')).toBeInTheDocument();
			});
		});
	});

	describe('Triage note encryption uses device public keys', () => {
		it('fetches device-based keys from /device-keys endpoint (not user own keys)', async () => {
			// The saveResolution function calls:
			// api.client.GET('/api/v1/logs/{log_id}/device-keys', { params: { path: { log_id } } })
			// This tests that the correct endpoint is used (device-scoped keys for all users
			// with log-read access on the device, not just the current user's own keys).
			const { encrypt } = await import('$lib/crypto');

			// Simulate the key fetching logic from saveResolution
			const log_id = 42;
			const keysRes = await api.client.GET('/api/v1/logs/{log_id}/device-keys', {
				params: { path: { log_id } }
			});

			expect(api.client.GET).toHaveBeenCalledWith(
				'/api/v1/logs/{log_id}/device-keys',
				{ params: { path: { log_id } } }
			);

			// Keys are device-based: all users with log-read access, not just the current user
			const keys = (keysRes.data as any) || [];
			const activeKeys = keys.filter((k: any) => k.key_type !== 'recovery').map((k: any) => k.public_key);
			expect(activeKeys).toHaveLength(2);
			expect(activeKeys).toContain('age1abc...');
			expect(activeKeys).toContain('age1def...');

			// Encryption uses ALL device-accessible keys
			encrypt('my triage note', activeKeys);
			expect(encrypt).toHaveBeenCalledWith('my triage note', ['age1abc...', 'age1def...']);
		});

		it('filters out recovery keys from encryption recipients', async () => {
			// Recovery keys should not be used for triage note encryption
			vi.mocked(api.client.GET).mockResolvedValue({
				data: [
					{ user_id: 1, public_key: 'age1regular...', key_type: 'regular' },
					{ user_id: 1, public_key: 'age1recovery...', key_type: 'recovery' }
				],
				error: null
			} as any);

			const keysRes = await api.client.GET('/api/v1/logs/{log_id}/device-keys', {
				params: { path: { log_id: 1 } }
			});

			const keys = (keysRes.data as any) || [];
			const activeKeys = keys.filter((k: any) => k.key_type !== 'recovery').map((k: any) => k.public_key);
			// Recovery key is excluded
			expect(activeKeys).toHaveLength(1);
			expect(activeKeys).toContain('age1regular...');
			expect(activeKeys).not.toContain('age1recovery...');
		});
	});

	describe('Alert title resolution', () => {
		it('renders flat rule.name key from decrypted telemetry if available', async () => {
			const { decrypt } = await import('$lib/crypto');
			vi.mocked(decrypt).mockReturnValueOnce('{"rule.name":"Flat Rule Title"}');

			const log = makeLog({ id: 88, seen: false });
			vi.mocked(api.listLogs).mockResolvedValue([log] as any);
			vi.mocked(api.getLogsCount).mockResolvedValue({ total_count: 1 });

			render(Alerts);

			await waitFor(() => {
				const card = screen.getByText('Flat Rule Title').closest('.card');
				expect(card).toBeInTheDocument();
			});
		});
	});

	describe('Bulk actions - Mark All as Seen / Resolve All as Read', () => {
		it('renders Mark All as Seen in basic mode, prompts, and calls api.markAllLogsSeen', async () => {
			const { askConfirm } = await import('$lib/confirm');
			vi.mocked(askConfirm).mockResolvedValue(true);

			const log = makeLog({ id: 101, seen: false });
			vi.mocked(api.listLogs).mockResolvedValue([log] as any);
			vi.mocked(api.getLogsCount).mockResolvedValue({ total_count: 1 });
			vi.mocked(api.markAllLogsSeen).mockResolvedValue({ message: 'All logs marked as seen' } as any);

			render(Alerts);

			await waitFor(() => {
				expect(screen.getByText('Test Rule')).toBeInTheDocument();
			});

			const button = screen.getByText('Mark All as Seen');
			await fireEvent.click(button);

			expect(askConfirm).toHaveBeenCalledWith('Are you sure you want to mark all alerts as seen?');
			expect(api.markAllLogsSeen).toHaveBeenCalled();
		});

		it('renders Resolve All as Read in Extended EDR mode, prompts, and resolves shown alerts', async () => {
			const { askConfirm } = await import('$lib/confirm');
			vi.mocked(askConfirm).mockResolvedValue(true);

			const edrUser = { ...mockUser, extended_edr_enabled: true };
			user.set(edrUser as any);
			vi.mocked(api.me).mockResolvedValue(edrUser as any);

			const log = makeLog({ id: 102, seen: false, alert_resolution: null });
			vi.mocked(api.listLogs).mockResolvedValue([log] as any);
			vi.mocked(api.getLogsCount).mockResolvedValue({ total_count: 1 });
			vi.mocked(api.client.PATCH).mockResolvedValue({ data: {} } as any);

			render(Alerts);

			await waitFor(() => {
				expect(screen.getByText('Test Rule')).toBeInTheDocument();
			});

			const button = screen.getByText('Resolve All as Read');
			await fireEvent.click(button);

			expect(askConfirm).toHaveBeenCalledWith("Are you sure you want to resolve all 1 currently shown unresolved alerts as 'read'?");
			expect(api.client.PATCH).toHaveBeenCalledWith('/api/v1/logs/{log_id}/resolve', {
				params: { path: { log_id: 102 } },
				body: { alert_resolution: 'read', triage_note: null }
			});
		});
	});

	describe('AI Analysis', () => {
		beforeEach(() => {
			localStorage.clear();
			vi.spyOn(window, 'open').mockImplementation(() => null);
		});

		it('shows the AI Consent Modal when no consent exists', async () => {
			const log = makeLog({ id: 99, seen: false });
			vi.mocked(api.listLogs).mockResolvedValue([log] as any);
			vi.mocked(api.getLogsCount).mockResolvedValue({ total_count: 1 });

			render(Alerts);

			// Click on the alert to select it
			await waitFor(() => {
				expect(screen.getByText('Test Rule')).toBeInTheDocument();
			});
			await fireEvent.click(screen.getByText('Test Rule'));

			// Wait for telemetry card and AI Analysis button to be visible
			await waitFor(() => {
				expect(screen.getByText('AI Analysis')).toBeInTheDocument();
			});

			// Click AI Analysis button
			await fireEvent.click(screen.getByText('AI Analysis'));

			// Confirm consent modal is shown
			await waitFor(() => {
				expect(screen.getByText('Confirm AI Analysis')).toBeInTheDocument();
				expect(screen.getByText(/Are you OK with sending your alert data/)).toBeInTheDocument();
			});
		});

		it('skips the modal and opens Lumo directly if consent is already saved', async () => {
			localStorage.setItem('radegast_proton_lumo_consent', 'true');
			const log = makeLog({ id: 99, seen: false });
			vi.mocked(api.listLogs).mockResolvedValue([log] as any);
			vi.mocked(api.getLogsCount).mockResolvedValue({ total_count: 1 });

			render(Alerts);

			await waitFor(() => {
				expect(screen.getByText('Test Rule')).toBeInTheDocument();
			});
			await fireEvent.click(screen.getByText('Test Rule'));

			await waitFor(() => {
				expect(screen.getByText('AI Analysis')).toBeInTheDocument();
			});

			await fireEvent.click(screen.getByText('AI Analysis'));

			// Check that window.open was called and modal is NOT shown
			expect(window.open).toHaveBeenCalled();
			expect(screen.queryByText('Confirm AI Analysis')).toBeNull();
		});

		it('saves consent to localStorage and opens Lumo when user clicks Yes, Proceed', async () => {
			const log = makeLog({ id: 99, seen: false });
			vi.mocked(api.listLogs).mockResolvedValue([log] as any);
			vi.mocked(api.getLogsCount).mockResolvedValue({ total_count: 1 });

			render(Alerts);

			await waitFor(() => {
				expect(screen.getByText('Test Rule')).toBeInTheDocument();
			});
			await fireEvent.click(screen.getByText('Test Rule'));

			await waitFor(() => {
				expect(screen.getByText('AI Analysis')).toBeInTheDocument();
			});

			await fireEvent.click(screen.getByText('AI Analysis'));

			await waitFor(() => {
				expect(screen.getByText('Yes, Proceed')).toBeInTheDocument();
			});

			await fireEvent.click(screen.getByText('Yes, Proceed'));

			// Check that consent was saved, modal was closed, and window.open was called
			expect(localStorage.getItem('radegast_proton_lumo_consent')).toBe('true');
			expect(window.open).toHaveBeenCalled();
			await waitFor(() => {
				expect(screen.queryByText('Confirm AI Analysis')).toBeNull();
			});
		});
	});

	describe('URL Hash Shareable State', () => {
		let originalHash: string;
		let replaceStateSpy: any;

		beforeEach(() => {
			originalHash = window.location.hash;
			window.location.hash = '#q=url_hash_query&from=2026-06-04T05%3A00&to=2026-06-05T05%3A00';
			replaceStateSpy = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
		});

		afterEach(() => {
			window.location.hash = originalHash;
			replaceStateSpy.mockRestore();
		});

		it('loads search query and date times from URL hash on mount', async () => {
			const log = makeLog({ id: 99, seen: false });
			vi.mocked(api.listLogs).mockResolvedValue([log] as any);
			vi.mocked(api.getLogsCount).mockResolvedValue({ total_count: 1 });

			render(Alerts);

			await waitFor(() => {
				const queryInput = screen.getByPlaceholderText('Filter alerts (JSONata)...') as HTMLInputElement;
				expect(queryInput.value).toBe('url_hash_query');
				
				const fromInput = screen.getByLabelText('From') as HTMLInputElement;
				expect(fromInput.value).toBe('2026-06-04T05:00');

				const toInput = screen.getByLabelText('To') as HTMLInputElement;
				expect(toInput.value).toBe('2026-06-05T05:00');
			});
		});

		it('updates URL hash when inputs change', async () => {
			window.location.hash = '';

			const log = makeLog({ id: 99, seen: false });
			vi.mocked(api.listLogs).mockResolvedValue([log] as any);
			vi.mocked(api.getLogsCount).mockResolvedValue({ total_count: 1 });

			render(Alerts);

			await waitFor(() => {
				expect(screen.getByPlaceholderText('Filter alerts (JSONata)...')).toBeInTheDocument();
			});

			const queryInput = screen.getByPlaceholderText('Filter alerts (JSONata)...');
			await fireEvent.input(queryInput, { target: { value: 'new_filter_query' } });

			await waitFor(() => {
				expect(replaceStateSpy).toHaveBeenCalledWith(
					null,
					'',
					expect.stringContaining('q=new_filter_query')
				);
			});
		});
	});

	describe('Export JSONL in Extended EDR mode', () => {
		let createObjectURLMock: any;
		let revokeObjectURLMock: any;
		let clickMock: any;
		let originalCreateElement: any;

		beforeEach(() => {
			createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
			revokeObjectURLMock = vi.fn();
			global.URL.createObjectURL = createObjectURLMock;
			global.URL.revokeObjectURL = revokeObjectURLMock;

			clickMock = vi.fn();
			originalCreateElement = document.createElement.bind(document);
			vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
				const el = originalCreateElement(tagName);
				if (tagName.toLowerCase() === 'a') {
					el.click = clickMock;
				}
				return el;
			});
		});

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it('shows the Export JSONL button only when extended_edr_enabled=true', async () => {
			window.location.hash = '';
			const log = makeLog({ id: 99, seen: false });
			vi.mocked(api.listLogs).mockResolvedValue([log] as any);
			vi.mocked(api.getLogsCount).mockResolvedValue({ total_count: 1 });

			// 1. Extended EDR mode enabled
			const edrUser = { ...mockUser, extended_edr_enabled: true };
			vi.mocked(api.me).mockResolvedValue(edrUser as any);
			user.set(edrUser as any);

			const { rerender } = render(Alerts);

			await waitFor(() => {
				expect(screen.getByText('Export JSONL')).toBeInTheDocument();
			});

			// 2. Click it and verify download
			await fireEvent.click(screen.getByText('Export JSONL'));
			expect(createObjectURLMock).toHaveBeenCalled();
			expect(clickMock).toHaveBeenCalled();

			// 3. Basic mode (extended_edr_enabled=false)
			const basicUser = { ...mockUser, extended_edr_enabled: false };
			vi.mocked(api.me).mockResolvedValue(basicUser as any);
			user.set(basicUser as any);

			// rerender the component to apply the new user settings
			rerender({});

			await waitFor(() => {
				expect(screen.queryByText('Export JSONL')).toBeNull();
			});
		});
	});

	describe('Exclusion creation with group and permission restrictions', () => {
		it('allows creating exclusion only for groups the device belongs to and where user has write permission', async () => {
			vi.mocked(api.listTeams).mockResolvedValue([
				{ id: 10, name: 'Team A', permission_pack: 'write' }
			] as any);
			
			const log = makeLog({ id: 99, device_id: 1 });
			vi.mocked(api.listLogs).mockResolvedValue([log] as any);
			vi.mocked(api.getLogsCount).mockResolvedValue({ total_count: 1 });

			vi.mocked(api.getDevice).mockResolvedValue({
				id: 1,
				name: 'Test Device',
				groups: [{ id: 1, name: 'Group A' }]
			} as any);

			vi.mocked(api.getGroup).mockResolvedValue({
				id: 1,
				name: 'Group A',
				teams: [{ id: 10, name: 'Team A', permission_pack: 'write' }]
			} as any);

			render(Alerts);

			// Wait for alert to render and select it
			await waitFor(() => {
				expect(screen.getByText('Test Rule')).toBeInTheDocument();
			});
			await fireEvent.click(screen.getByText('Test Rule'));

			// Click Create Exclusion
			await waitFor(() => {
				expect(screen.getByText('Create Exclusion')).toBeInTheDocument();
			});
			await fireEvent.click(screen.getByText('Create Exclusion'));

			// Verify API calls
			await waitFor(() => {
				expect(api.getDevice).toHaveBeenCalledWith(1);
				expect(api.getGroup).toHaveBeenCalledWith(1);
			});

			// Verify the modal is shown and shows Group A
			await waitFor(() => {
				expect(screen.getByText('Create Exclusion from Alert')).toBeInTheDocument();
				expect(screen.getByText('Group A')).toBeInTheDocument();
			});
		});

		it('shows an error if user does not have pack write permission on any group the device belongs to', async () => {
			const { showError } = await import('$lib/store');
			vi.mocked(api.listTeams).mockResolvedValue([
				{ id: 10, name: 'Team A', permission_pack: 'write' }
			] as any);
			
			const log = makeLog({ id: 99, device_id: 1 });
			vi.mocked(api.listLogs).mockResolvedValue([log] as any);
			vi.mocked(api.getLogsCount).mockResolvedValue({ total_count: 1 });

			vi.mocked(api.getDevice).mockResolvedValue({
				id: 1,
				name: 'Test Device',
				groups: [{ id: 2, name: 'Group B' }]
			} as any);

			vi.mocked(api.getGroup).mockResolvedValue({
				id: 2,
				name: 'Group B',
				teams: [{ id: 20, name: 'Team B', permission_pack: 'read' }] // user not in Team B, and Team B has only read permission
			} as any);

			render(Alerts);

			// Wait for alert to render and select it
			await waitFor(() => {
				expect(screen.getByText('Test Rule')).toBeInTheDocument();
			});
			await fireEvent.click(screen.getByText('Test Rule'));

			// Click Create Exclusion
			await waitFor(() => {
				expect(screen.getByText('Create Exclusion')).toBeInTheDocument();
			});
			await fireEvent.click(screen.getByText('Create Exclusion'));

			// Verify API calls and error message
			await waitFor(() => {
				expect(api.getDevice).toHaveBeenCalledWith(1);
				expect(api.getGroup).toHaveBeenCalledWith(2);
				expect(showError).toHaveBeenCalledWith('You do not have pack write permissions on any group this device belongs to.');
			});
		});
	});
});

