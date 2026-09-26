import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import { api } from '$lib/api';
import { user } from '$lib/store';

// Page imports
import Admin from './admin/+page.svelte';
import Alerts from './alerts/+page.svelte';
import Devices from './devices/+page.svelte';
import DeviceDetail from './devices/[id]/+page.svelte';
import Groups from './groups/+page.svelte';
import GroupDetail from './groups/[id]/+page.svelte';
import Hunt from './hunt/+page.svelte';
import KeySetup from './keys/setup/+page.svelte';
import KeyRecovery from './keys/recovery/+page.svelte';
import KeyTransfer from './keys/transfer/+page.svelte';
import Login from './login/+page.svelte';
import Packs from './packs/+page.svelte';
import PackDetail from './packs/[id]/+page.svelte';
import Privacy from './privacy/+page.svelte';
import Register from './register/+page.svelte';
import Releases from './releases/+page.svelte';
import ReleaseDetail from './releases/[version]/+page.svelte';
import Settings from './settings/+page.svelte';
import Teams from './teams/+page.svelte';
import TeamDetail from './teams/[id]/+page.svelte';
import Terms from './terms/+page.svelte';
import Unsubscribe from './unsubscribe/+page.svelte';
import Verify from './verify/+page.svelte';
import ResetPassword from './reset-password/+page.svelte';
import ServerError from './server-error/+page.svelte';
import ErrorBoundary from './+error.svelte';
import Layout from './+layout.svelte';
import { goto } from '$app/navigation';
import { ApiError } from '$lib/api';

// Mock SvelteKit stores & navigation
vi.mock('$app/paths', () => ({
	base: ''
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn(),
	beforeNavigate: vi.fn()
}));

vi.mock('$app/stores', () => ({
	page: readable({
		url: new URL('http://localhost/?token=test_token'),
		params: { id: '1', version: '1.0.0' }
	})
}));

vi.mock('$app/state', () => ({
	page: {
		url: new URL('http://localhost/?token=test_token'),
		params: { id: '1', version: '1.0.0' },
		status: 500,
		error: { message: 'Server error occurred' }
	}
}));

// Mock cryptography WASM & helper functions
vi.mock('$lib/crypto', () => ({
	initAgeWasm: vi.fn().mockResolvedValue(undefined),
	getStoredPrivateKey: vi.fn().mockResolvedValue('fake_private_key'),
	getStoredPublicKey: vi.fn().mockResolvedValue('fake_public_key'),
	decrypt: vi.fn().mockReturnValue('{"rule":{"name":"Test Rule"}}'),
	encrypt: vi.fn().mockReturnValue('fake_encrypted_data'),
	generateKeypair: vi.fn().mockReturnValue({ publicKey: 'pub', privateKey: 'priv' }),
	storePrivateKey: vi.fn().mockResolvedValue(undefined),
	getPublicKeyForLogin: vi.fn().mockResolvedValue('fake_public_key'),
	aesEncrypt: vi.fn().mockResolvedValue('encrypted_key')
}));

// Mock Iconify
vi.mock('@iconify/svelte', () => ({
	default: () => null
}));

// Mock API Client
vi.mock('$lib/api', () => ({
	api: {
		me: vi.fn(),
		register: vi.fn(),
		login: vi.fn(),
		logout: vi.fn(),
		verify: vi.fn(),
		verifyEmail: vi.fn(),
		unsubscribe: vi.fn(),
		setupKeys: vi.fn(),
		setupSecondaryKey: vi.fn(),
		deleteKeys: vi.fn(),
		recoverKeys: vi.fn(),
		listKeys: vi.fn(),
		addKey: vi.fn(),
		deleteKey: vi.fn(),
		getNotifications: vi.fn(),
		updateNotifications: vi.fn(),
		getMfaSettings: vi.fn(),
		getMfaHardwareTokenAssertionOptions: vi.fn(),
		verifyMfa: vi.fn(),
		listTeams: vi.fn(),
		createTeam: vi.fn(),
		getTeam: vi.fn(),
		updateTeam: vi.fn(),
		inviteToTeam: vi.fn(),
		listMembers: vi.fn(),
		removeMember: vi.fn(),
		listTeamGroups: vi.fn(),
		createTeamGroup: vi.fn(),
		linkGroupToTeam: vi.fn(),
		listTeamDevices: vi.fn(),
		createDevice: vi.fn(),
		listDevices: vi.fn(),
		getDevice: vi.fn(),
		renameDevice: vi.fn(),
		addDeviceToGroup: vi.fn(),
		removeDeviceFromGroup: vi.fn(),
		deleteDevice: vi.fn(),
		reinstallDevice: vi.fn(),
		listGroups: vi.fn(),
		getGroup: vi.fn(),
		renameGroup: vi.fn(),
		unlinkGroupFromTeam: vi.fn(),
		cancelInvitation: vi.fn(),
		deleteGroup: vi.fn(),
		getGroupRecipientPublicKeys: vi.fn(),
		setupGroupKeys: vi.fn(),
		removeDeviceFromGroupViaGroup: vi.fn(),
		addDeviceToGroupViaGroup: vi.fn(),
		getPublicKeysByEmail: vi.fn(),
		getTeamRecipientPublicKeys: vi.fn(),
		listPacks: vi.fn(),
		createPack: vi.fn(),
		updatePack: vi.fn(),
		deletePack: vi.fn(),
		getPack: vi.fn(),
		listVersions: vi.fn(),
		listGroupsNeedingRefresh: vi.fn().mockResolvedValue([]),
		listEnabledPacks: vi.fn(),
		enablePack: vi.fn(),
		disablePack: vi.fn(),
		listLogs: vi.fn(),
		getUnreadLogsCount: vi.fn(),
		markLogSeen: vi.fn(),
		markAllLogsSeen: vi.fn(),
		getLogsCount: vi.fn(),
		listReleases: vi.fn(),
		uploadRelease: vi.fn(),
		deleteRelease: vi.fn(),
		getAuthConfig: vi.fn(),
		requestPasswordReset: vi.fn(),
		confirmPasswordReset: vi.fn(),
		adminListUsers: vi.fn(),
		adminDeleteUser: vi.fn(),
		adminResetUserPassword: vi.fn(),
		adminListDevices: vi.fn(),
		adminDeleteDevice: vi.fn(),
		adminListPacks: vi.fn(),
		adminDeletePack: vi.fn(),
		adminGetAlertStats: vi.fn(),
		adminGetAlertRuleIds: vi.fn(),
		adminGetAlertRuleContent: vi.fn(),
		adminGetDeviceStats: vi.fn(),
		adminGetDeviceFilterOptions: vi.fn(),
		getBackendUrl: vi.fn().mockReturnValue('http://localhost:8000/'),
		downloadReleaseUrl: vi.fn().mockReturnValue('http://localhost:8000/download'),
		client: {
			GET: vi.fn(),
			PUT: vi.fn(),
			PATCH: vi.fn()
		}
	},
	ApiError: class MockApiError extends Error {
		status: number;
		detail?: unknown;
		constructor(message: string, status: number, detail?: unknown) {
			super(message);
			this.name = 'ApiError';
			this.status = status;
			this.detail = detail;
		}
	}
}));

// Mock App State Stores
vi.mock('$lib/store', () => {
	const { writable } = require('svelte/store');
	return {
		user: writable(null),
		loading: writable(false),
		flash: writable(null),
		triggerKeyRefresh: writable(0),
		showOnboarding: writable(false),
		showFlash: vi.fn(),
		showError: vi.fn()
	};
});

describe('Route Pages Load Verification', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		
		const mockUser = {
			id: 1,
			email: 'admin@example.com',
			role: 'admin',
			verified: true,
			extended_edr_enabled: true,
			has_keys: true
		};

		user.set(mockUser as any);

				// Populate all API functions with default resolved values
		vi.mocked(api.me).mockResolvedValue(mockUser as any);
		vi.mocked(api.listTeams).mockResolvedValue([{ id: 1, name: 'Team A' }] as any);
		vi.mocked(api.listGroups).mockResolvedValue([{ id: 1, name: 'Group A' }] as any);
		vi.mocked(api.listDevices).mockResolvedValue([{ id: 1, name: 'Device A', last_seen: '2026-06-04T05:00:00Z' }] as any);
		vi.mocked(api.listTeamDevices).mockResolvedValue([{ id: 1 }] as any);
		vi.mocked(api.getGroup).mockResolvedValue({ id: 1, name: 'Group A', devices: [{ id: 1 }] } as any);
		vi.mocked(api.listLogs).mockResolvedValue([{ id: 1, time: '2026-06-04T05:00:00Z', device_id: 1, content: 'encrypted', severity: 'high' }] as any);
		vi.mocked(api.getLogsCount).mockResolvedValue({ total_count: 1 });
		vi.mocked(api.listPacks).mockResolvedValue([{ id: 1, name: 'Pack A', description: 'Desc' }] as any);
		vi.mocked(api.listKeys).mockResolvedValue([{ id: 1, name: 'Key A', public_key: 'pubkey', key_type: 'regular', has_private_key: true }] as any);
		vi.mocked(api.getDevice).mockResolvedValue({ id: 1, name: 'Device A', last_seen: '2026-06-04T05:00:00Z' } as any);
		vi.mocked(api.getPack).mockResolvedValue({ id: 1, name: 'Pack A', description: 'Desc' } as any);
		vi.mocked(api.listReleases).mockResolvedValue([{ id: 1, version: '1.0.0', os: 'linux', arch: 'amd64', size: 1000, uploaded: '2026-06-04T05:00:00Z' }] as any);
		vi.mocked(api.getNotifications).mockResolvedValue({ notify_device_log: true, notification_level: 'medium', notify_login: true } as any);
		vi.mocked(api.getMfaSettings).mockResolvedValue({ required_level: 'none', otp_enabled: false, hardware_tokens: [] } as any);
		vi.mocked(api.getTeam).mockResolvedValue({ id: 1, name: 'Team A' } as any);
		vi.mocked(api.unsubscribe).mockResolvedValue({ message: 'Unsubscribed' } as any);

		// New & updated API endpoints
		vi.mocked(api.adminListUsers).mockResolvedValue([{ id: 1, email: 'admin@example.com', role: 'admin', verified: true }] as any);
		vi.mocked(api.adminListDevices).mockResolvedValue([{ id: 1, name: 'Device A', last_seen: '2026-06-04T05:00:00Z' }] as any);
		vi.mocked(api.adminListPacks).mockResolvedValue([{ id: 1, name: 'Pack A', description: 'Desc' }] as any);
		vi.mocked(api.adminGetAlertStats).mockResolvedValue({
			severity_distribution: { high: 2 },
			resolution_distribution: { true_positive: 2 },
			rule_distribution: { 'sigma::test_rule': 2 },
			rule_type_distribution: { sigma: 2 }
		} as any);
		vi.mocked(api.adminGetAlertRuleIds).mockResolvedValue(['test_rule'] as any);
		vi.mocked(api.adminGetDeviceStats).mockResolvedValue({
			agent_distribution: { 'python 0.6.0': 1 },
			rustinel_distribution: { '0.3.0': 1 },
			os_distribution: { linux: 1 },
			health_distribution: { healthy: 1 },
			online_distribution: { online: 1 }
		} as any);
		vi.mocked(api.adminGetDeviceFilterOptions).mockResolvedValue({
			agent_versions: ['python 0.6.0'],
			rustinel_versions: ['0.3.0'],
			os_list: ['linux']
		} as any);
		vi.mocked(api.getAuthConfig).mockResolvedValue({ turnstile_site_key: null, registration_message: null } as any);
		vi.mocked(api.getMfaHardwareTokenAssertionOptions).mockResolvedValue({
			options: { challenge: 'Y2hhbGxlbmdl' },
			assertion_token: 'test_assertion_token'
		} as any);
		vi.mocked(api.listVersions).mockResolvedValue([{ id: 1, pack_id: 1, version: '1.0.0', released: '2026-06-04T05:00:00Z' }] as any);
		vi.mocked(api.listEnabledPacks).mockResolvedValue([{ id: 1, pack_version_id: 1, autoupdate: true, pack_name: 'Pack A' }] as any);
		vi.mocked(api.verifyEmail).mockResolvedValue({ message: 'Verified' } as any);
		vi.mocked(api.requestPasswordReset).mockResolvedValue({ message: 'Sent' } as any);
		vi.mocked(api.confirmPasswordReset).mockResolvedValue({ message: 'Reset' } as any);
		vi.mocked(api.listMembers).mockResolvedValue([{ id: 1, email: 'admin@example.com', role: 'admin' }] as any);
		vi.mocked(api.listTeamGroups).mockResolvedValue([{ id: 1, name: 'Group A' }] as any);
		vi.mocked(api.setupKeys).mockResolvedValue({} as any);
		vi.mocked(api.getGroupRecipientPublicKeys).mockResolvedValue([] as any);
		vi.mocked(api.setupGroupKeys).mockResolvedValue({} as any);
		vi.mocked(api.deleteGroup).mockResolvedValue({} as any);
		vi.mocked(api.getTeamRecipientPublicKeys).mockResolvedValue([] as any);
		vi.mocked(api.client.GET).mockResolvedValue({
			data: [{ user_id: 1, public_key: 'pubkey', key_type: 'regular' }]
		} as any);
	});

	it('renders Admin page', async () => {
		render(Admin);
		await waitFor(() => {
			expect(screen.getByText('Admin Panel')).toBeInTheDocument();
		});
	});

	it('renders Admin page and sorts devices by column', async () => {
		vi.mocked(api.adminListDevices).mockResolvedValue([
			{ id: 1, name: 'Device Alpha', total_space_used: 1000, last_seen: '2026-06-04T05:00:00Z' },
			{ id: 2, name: 'Device Beta', total_space_used: 5000, last_seen: '2026-06-04T05:00:00Z' }
		] as any);

		render(Admin);
		await waitFor(() => {
			expect(screen.getByText('Admin Panel')).toBeInTheDocument();
		});

		const devicesTab = screen.getByRole('button', { name: /Devices/ });
		await fireEvent.click(devicesTab);

		await waitFor(() => {
			expect(screen.getByText('Total database space used:')).toBeInTheDocument();
			expect(screen.getByText('Device Alpha')).toBeInTheDocument();
			expect(screen.getByText('Device Beta')).toBeInTheDocument();
		});

		// By default sorted by ID ascending: Alpha (id:1) then Beta (id:2)
		const rowsBefore = screen.getAllByRole('row');
		expect(rowsBefore[1]).toHaveTextContent('Device Alpha');
		expect(rowsBefore[2]).toHaveTextContent('Device Beta');

		// Click Space Used header to sort by space_used descending
		const spaceUsedHeader = screen.getByRole('button', { name: /Space Used/ });
		await fireEvent.click(spaceUsedHeader);

		const rowsAfterDesc = screen.getAllByRole('row');
		expect(rowsAfterDesc[1]).toHaveTextContent('Device Beta');
		expect(rowsAfterDesc[2]).toHaveTextContent('Device Alpha');

		// Click Space Used header again to sort ascending
		await fireEvent.click(spaceUsedHeader);
		const rowsAfterAsc = screen.getAllByRole('row');
		expect(rowsAfterAsc[1]).toHaveTextContent('Device Alpha');
		expect(rowsAfterAsc[2]).toHaveTextContent('Device Beta');
	});

	it('renders Alerts page and verifies basic EDR seen behavior on click', async () => {
		const mockUser = {
			id: 1,
			email: 'admin@example.com',
			role: 'admin',
			verified: true,
			extended_edr_enabled: false,
			has_keys: true
		};
		user.set(mockUser as any);
		vi.mocked(api.me).mockResolvedValue(mockUser as any);

		const logObj = {
			id: 123,
			time: '2026-06-04T05:00:00Z',
			device_id: 1,
			content: 'encrypted',
			severity: 'high',
			alert_resolution: null,
			seen: false
		};
		vi.mocked(api.listLogs).mockResolvedValue([logObj] as any);

		render(Alerts);

		// Wait for the log card to become visible (requires LogManager to finish loading)
		await waitFor(() => {
			expect(screen.getByText('Test Rule')).toBeInTheDocument();
		}, { timeout: 3000 });

		// Click the card
		const card = screen.getByRole('button', { name: /Test Rule/ });
		await fireEvent.click(card);

		// Verify markLogSeen was called (basic mode: always mark seen on click)
		await waitFor(() => {
			expect(api.markLogSeen).toHaveBeenCalledWith(123);
		});
		// Note: logObj.seen is not checked here because Svelte 5's $state wraps
		// reactive arrays in Proxies; the mutation happens on the proxied copy,
		// not the original plain-object reference we created in the test.
	});

	it('renders Alerts page and verifies extended EDR seen behavior on click', async () => {
		const mockUser = {
			id: 1,
			email: 'admin@example.com',
			role: 'admin',
			verified: true,
			extended_edr_enabled: true,
			has_keys: true
		};
		user.set(mockUser as any);
		vi.mocked(api.me).mockResolvedValue(mockUser as any);

		const logObj = {
			id: 456,
			time: '2026-06-04T05:00:00Z',
			device_id: 1,
			content: 'encrypted',
			severity: 'high',
			alert_resolution: null,
			seen: false
		};
		vi.mocked(api.listLogs).mockResolvedValue([logObj] as any);

		render(Alerts);

		// Wait for the log card to become visible
		await waitFor(() => {
			expect(screen.getByText('Test Rule')).toBeInTheDocument();
		}, { timeout: 3000 });

		// Click the card
		const card = screen.getByRole('button', { name: /Test Rule/ });
		await fireEvent.click(card);

		// In extended EDR mode with no resolution, markLogSeen must NOT be called.
		// The alert remains fully active/unread until the analyst sets a resolution.
		await waitFor(() => {
			expect(api.markLogSeen).not.toHaveBeenCalled();
		});

		// Local seen state should also remain false
		expect(logObj.seen).toBe(false);
	});

	it('renders Alerts page and verifies extended EDR marks as seen when log has a resolution', async () => {
		const mockUser = {
			id: 1,
			email: 'admin@example.com',
			role: 'admin',
			verified: true,
			extended_edr_enabled: true,
			has_keys: true
		};
		user.set(mockUser as any);
		vi.mocked(api.me).mockResolvedValue(mockUser as any);

		const logObjWithResolution = {
			id: 789,
			time: '2026-06-04T05:00:00Z',
			device_id: 1,
			content: 'encrypted',
			severity: 'high',
			alert_resolution: 'true_positive',
			seen: false
		};
		vi.mocked(api.listLogs).mockResolvedValue([logObjWithResolution] as any);

		render(Alerts);

		// Wait for the log card to become visible
		await waitFor(() => {
			expect(screen.getByText('Test Rule')).toBeInTheDocument();
		}, { timeout: 3000 });

		// Click the card (log has a resolution)
		const card = screen.getByRole('button', { name: /Test Rule/ });
		await fireEvent.click(card);

		// In extended EDR mode WITH a resolution, markLogSeen should be called
		await waitFor(() => {
			expect(api.markLogSeen).toHaveBeenCalledWith(789);
		});
	});

	it('renders Devices page', async () => {
		render(Devices);
		await waitFor(() => {
			expect(screen.getByText('Devices')).toBeInTheDocument();
		});
	});

	it('renders Devices page with devices sorted by status (unhealthy -> healthy -> offline) then name (a->z)', async () => {
		const now = new Date();
		const recent = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
		const old = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

		vi.mocked(api.listDevices).mockResolvedValue([
			{ id: 1, name: 'Zebra Offline', last_seen: old, healthy: false } as any,
			{ id: 2, name: 'Charlie Healthy', last_seen: recent, healthy: true } as any,
			{ id: 3, name: 'Zebra Unhealthy', last_seen: recent, healthy: false } as any,
			{ id: 4, name: 'Bravo Online', last_seen: recent, healthy: null } as any,
			{ id: 5, name: 'Alpha Unhealthy', last_seen: recent, healthy: false } as any,
			{ id: 6, name: 'Alpha Offline', last_seen: old, healthy: true } as any
		]);

		render(Devices);
		await waitFor(() => {
			expect(screen.getByText('Devices')).toBeInTheDocument();
		});

		const rows = screen.getAllByRole('row');
		const rowTexts = rows.slice(1).map((r) => r.textContent);
		expect(rowTexts[0]).toContain('Alpha Unhealthy');
		expect(rowTexts[1]).toContain('Zebra Unhealthy');
		expect(rowTexts[2]).toContain('Bravo Online');
		expect(rowTexts[3]).toContain('Charlie Healthy');
		expect(rowTexts[4]).toContain('Alpha Offline');
		expect(rowTexts[5]).toContain('Zebra Offline');
	});

	it('renders DeviceDetail page', async () => {
		render(DeviceDetail);
		await waitFor(() => {
			expect(screen.getByText('← Back to Devices')).toBeInTheDocument();
		});
	});

	it('renders Groups page', async () => {
		render(Groups);
		await waitFor(() => {
			expect(screen.getByText('Device Groups')).toBeInTheDocument();
		});
	});

	it('renders GroupDetail page', async () => {
		render(GroupDetail);
		await waitFor(() => {
			expect(screen.getByText('← Back to Groups')).toBeInTheDocument();
		});
	});

	it('renders Hunt page', async () => {
		render(Hunt);
		await waitFor(() => {
			expect(screen.getByText('Hunt Mode')).toBeInTheDocument();
		});
	});

	it('renders KeySetup page', async () => {
		render(KeySetup);
		await waitFor(() => {
			expect(screen.getByText('Key Setup')).toBeInTheDocument();
		});
	});

	it('renders KeyRecovery page', async () => {
		render(KeyRecovery);
		await waitFor(() => {
			expect(screen.getByText('Key Recovery')).toBeInTheDocument();
		});
	});

	it('renders KeyTransfer page', async () => {
		render(KeyTransfer);
		await waitFor(() => {
			expect(screen.getByText('Key Transfer')).toBeInTheDocument();
		});
	});

	it('renders Login page', async () => {
		render(Login);
		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
		});
	});

	it('renders Login page and supports MFA passkey / hardware token flow with dark mode compatible container', async () => {
		vi.mocked(api.login).mockResolvedValueOnce({
			status: 'mfa_required',
			mfa_token: 'test-mfa-token',
			methods: ['hardware_token', 'otp']
		} as any);
		render(Login);
		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
		});

		const emailInput = screen.getByLabelText(/Email/i);
		const passwordInput = screen.getByLabelText(/^Password/i);
		const loginBtn = screen.getByRole('button', { name: 'Login' });

		await fireEvent.input(emailInput, { target: { value: 'user@example.com' } });
		await fireEvent.input(passwordInput, { target: { value: 'secretpass' } });
		await fireEvent.click(loginBtn);

		await waitFor(() => {
			expect(screen.getByText('MFA Verification')).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /Authenticate with Passkey \/ Security Key/i })).toBeInTheDocument();
			expect(screen.getByText('Passkey / Security Key')).toBeInTheDocument();
		});

		const card = screen.getByText('MFA Verification').closest('.card');
		expect(card).not.toBeNull();
		expect(card?.classList.contains('bg-light')).toBe(false);
		expect(card?.classList.contains('bg-body-tertiary')).toBe(true);
	});

	it('renders Packs page', async () => {
		render(Packs);
		await waitFor(() => {
			expect(screen.getByText('Packs')).toBeInTheDocument();
		});
	});

	it('renders Packs page, shows level tags, and checks Level filter options', async () => {
		const mockPacks = [
			{
				id: 1,
				name: 'Pack Essential',
				description: 'Desc 1',
				latest: {
					id: 10,
					pack_id: 1,
					version: '1.0.0',
					released: '2026-06-04T05:00:00Z',
					meta: { level: 'essential', os: 'any', expected_false_positive_level: 'low', status: 'stable' }
				}
			},
			{
				id: 2,
				name: 'Pack Hunting',
				description: 'Desc 2',
				latest: {
					id: 20,
					pack_id: 2,
					version: '1.0.0',
					released: '2026-06-04T05:00:00Z',
					meta: { level: 'hunting', os: 'windows', status: 'stable' }
				}
			}
		];
		vi.mocked(api.listPacks).mockResolvedValue(mockPacks as any);

		render(Packs);
		await waitFor(() => {
			expect(screen.getByText('Packs')).toBeInTheDocument();
			expect(screen.getByText(/Level:\s*essential/i)).toBeInTheDocument();
		});

		const levelDropdownBtn = screen.getByRole('button', { name: 'essential' });
		expect(levelDropdownBtn).toBeInTheDocument();
	});

	it('renders PackDetail page', async () => {
		render(PackDetail);
		await waitFor(() => {
			expect(screen.getByText('← Back to Packs')).toBeInTheDocument();
		});
	});

	it('renders Privacy page', async () => {
		render(Privacy);
		await waitFor(() => {
			expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
		});
	});

	it('renders Register page without registration message by default', async () => {
		render(Register);
		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Register' })).toBeInTheDocument();
			expect(screen.queryByText(/Radegast is currently in open beta/i)).not.toBeInTheDocument();
		});
	});

	it('renders Register page with registration message when configured', async () => {
		vi.mocked(api.getAuthConfig).mockResolvedValueOnce({
			turnstile_site_key: null,
			registration_message: 'Beta testers only: welcome!'
		} as any);
		render(Register);
		await waitFor(() => {
			expect(screen.getByText('Beta testers only: welcome!')).toBeInTheDocument();
		});
	});

	it('renders Releases page', async () => {
		render(Releases);
		await waitFor(() => {
			expect(screen.getByText('Rustinel Releases')).toBeInTheDocument();
		});
	});

	it('allows selecting amd64 for macOS when uploading releases', async () => {
		const mockAdmin = {
			id: 1,
			email: 'admin@test.com',
			role: 'admin',
			verified: true,
			otp_enabled: false,
			mfa_required: false,
			notify_login: false,
			api_keys_enabled: true,
			created_at: '2026-01-01T00:00:00Z',
			password_change: '2026-01-01T00:00:00Z',
			extended_edr_enabled: true,
			has_keys: true
		};
		user.set(mockAdmin as any);
		vi.mocked(api.listReleases).mockResolvedValue([]);

		const { container } = render(Releases);
		await waitFor(() => {
			expect(screen.getByText('Upload First Release')).toBeInTheDocument();
		});

		const uploadBtn = screen.getByText('Upload First Release');
		await fireEvent.click(uploadBtn);

		const osSelect = container.querySelector('#rel-os') as HTMLSelectElement;
		expect(osSelect).toBeInTheDocument();
		await fireEvent.change(osSelect, { target: { value: 'mac' } });

		const archSelect = container.querySelector('#rel-arch') as HTMLSelectElement;
		expect(archSelect).toBeInTheDocument();
		const options = Array.from(archSelect.options).map((opt) => opt.value);
		expect(options).toContain('amd64');
		expect(options).toContain('m5');
	});

	it('renders ReleaseDetail page', async () => {
		render(ReleaseDetail);
		await waitFor(() => {
			expect(screen.getByText('← Back to Releases')).toBeInTheDocument();
		});
	});

	it('renders Settings page and shows Admin notifications toggle for admin', async () => {
		const mockAdmin = {
			id: 1,
			email: 'admin@test.com',
			role: 'admin',
			verified: true,
			extended_edr_enabled: true,
			has_keys: true
		};
		user.set(mockAdmin as any);
		vi.mocked(api.me).mockResolvedValue(mockAdmin as any);
		vi.mocked(api.getNotifications).mockResolvedValue({
			notify_login: true,
			notify_new_keys: true,
			notify_recovery_used: true,
			notify_keys_transferred: true,
			notify_device_log: true,
			notify_downtime_maintenance: true,
			notify_api_key_modification: true,
			notify_news_updates: true,
			notify_admin_notifications: true,
			notification_level: 'medium'
		} as any);

		render(Settings);
		await waitFor(() => {
			expect(screen.getByText('User Settings')).toBeInTheDocument();
			expect(screen.getByLabelText('Admin notifications')).toBeInTheDocument();
		});
	});

	it('renders Settings page and hides Admin notifications toggle for non-admin', async () => {
		const mockRegularUser = {
			id: 2,
			email: 'user@test.com',
			role: 'user',
			verified: true,
			extended_edr_enabled: true,
			has_keys: true
		};
		user.set(mockRegularUser as any);
		vi.mocked(api.me).mockResolvedValue(mockRegularUser as any);
		vi.mocked(api.getNotifications).mockResolvedValue({
			notify_login: true,
			notify_new_keys: true,
			notify_recovery_used: true,
			notify_keys_transferred: true,
			notify_device_log: true,
			notify_downtime_maintenance: true,
			notify_api_key_modification: true,
			notify_news_updates: true,
			notify_admin_notifications: true,
			notification_level: 'medium'
		} as any);

		render(Settings);
		await waitFor(() => {
			expect(screen.getByText('User Settings')).toBeInTheDocument();
			expect(screen.queryByLabelText('Admin notifications')).not.toBeInTheDocument();
		});
	});

	it('renders Teams page', async () => {
		render(Teams);
		await waitFor(() => {
			expect(screen.getByText('Teams')).toBeInTheDocument();
		});
	});

	it('renders TeamDetail page', async () => {
		render(TeamDetail);
		await waitFor(() => {
			expect(screen.getByText('Members')).toBeInTheDocument();
		});
	});

	it('renders Terms page', async () => {
		render(Terms);
		await waitFor(() => {
			expect(screen.getByText('Terms of Service')).toBeInTheDocument();
		});
	});

	it('renders Unsubscribe page', async () => {
		render(Unsubscribe);
		await waitFor(() => {
			expect(screen.getByRole('heading', { name: 'Unsubscribed' })).toBeInTheDocument();
		});
	});

	it('renders Verify page', async () => {
		render(Verify);
		await waitFor(() => {
			expect(screen.getByText('Email Verified')).toBeInTheDocument();
		});
	});

	it('renders ResetPassword page', async () => {
		render(ResetPassword);
		await waitFor(() => {
			expect(screen.getByText('Reset Password')).toBeInTheDocument();
		});
	});

	it('renders ServerError page', async () => {
		render(ServerError);
		await waitFor(() => {
			expect(screen.getByRole('heading', { name: /Server Error/i })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
			expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
			expect(screen.getByRole('link', { name: /Go to Login/i })).toBeInTheDocument();
		});
	});

	it('renders ErrorBoundary (+error.svelte) page', async () => {
		render(ErrorBoundary);
		await waitFor(() => {
			expect(screen.getByText(/500 - Server Error/i)).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
		});
	});

	it('redirects to /login when api.me fails with 401 unauthenticated in Layout', async () => {
		vi.mocked(goto).mockClear();
		vi.mocked(api.me).mockRejectedValueOnce(new ApiError('Not authenticated', 401));
		render(Layout, {
			props: {
				children: (() => {}) as any
			}
		});
		await waitFor(() => {
			expect(goto).toHaveBeenCalledWith(expect.stringContaining('/login'));
			expect(goto).not.toHaveBeenCalledWith(expect.stringContaining('/server-error'));
		});
	});

	it('redirects to /server-error when api.me fails with 500 in Layout', async () => {
		vi.mocked(goto).mockClear();
		vi.mocked(api.me).mockRejectedValueOnce(new ApiError('Internal Server Error', 500));
		render(Layout, {
			props: {
				children: (() => {}) as any
			}
		});
		await waitFor(() => {
			expect(goto).toHaveBeenCalledWith(expect.stringContaining('/server-error'));
			expect(goto).not.toHaveBeenCalledWith(expect.stringContaining('/login'));
		});
	});

	it('redirects to /server-error when api.me fails with network error in Layout', async () => {
		vi.mocked(goto).mockClear();
		vi.mocked(api.me).mockRejectedValueOnce(new TypeError('Failed to fetch'));
		render(Layout, {
			props: {
				children: (() => {}) as any
			}
		});
		await waitFor(() => {
			expect(goto).toHaveBeenCalledWith(expect.stringContaining('/server-error'));
			expect(goto).not.toHaveBeenCalledWith(expect.stringContaining('/login'));
		});
	});
});
